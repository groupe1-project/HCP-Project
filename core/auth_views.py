import logging
import os

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.utils.crypto import get_random_string
from django.core.exceptions import ValidationError
from django.core.cache import cache
from .models import CustomUser
from .throttles import LoginRateThrottle, PasswordResetRateThrottle
from .security_audit import audit_security_event

logger = logging.getLogger(__name__)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login(request):
    """
    Authentifie un utilisateur via email et mot de passe.
    Retourne un token d'authentification.
    """
    email = request.data.get('email')
    password = request.data.get('password')

    if not email or not password:
        audit_security_event('auth.login.missing_fields', request)
        return Response({'error': 'Email et mot de passe requis'}, status=status.HTTP_400_BAD_REQUEST)

    generic_error = {'error': 'Identifiants invalides'}

    # Cherche l'utilisateur par email
    try:
        user = CustomUser.objects.get(email=email)
    except CustomUser.DoesNotExist:
        audit_security_event('auth.login.failed', request, email=email, reason='user_not_found')
        return Response(generic_error, status=status.HTTP_401_UNAUTHORIZED)

    # Authentifie avec le mot de passe (utilise username pour authenticate)
    user_auth = authenticate(username=user.username, password=password)
    if user_auth is None or not user_auth.is_active:
        audit_security_event('auth.login.failed', request, email=email, reason='invalid_credentials_or_inactive')
        return Response(generic_error, status=status.HTTP_401_UNAUTHORIZED)

    # Rotation du token à chaque connexion pour réduire la surface d'exposition.
    Token.objects.filter(user=user_auth).delete()
    token = Token.objects.create(user=user_auth)

    response = Response({
        'token': token.key,
        'user_id': user_auth.id,
        'username': user_auth.username,
        'email': user_auth.email,
        'role': user_auth.role,
    }, status=status.HTTP_200_OK)

    response.set_cookie(
        settings.AUTH_TOKEN_COOKIE_NAME,
        token.key,
        max_age=settings.AUTH_TOKEN_COOKIE_AGE,
        httponly=True,
        secure=settings.AUTH_TOKEN_COOKIE_SECURE,
        samesite=settings.AUTH_TOKEN_COOKIE_SAMESITE,
        path='/',
    )
    audit_security_event('auth.login.success', request, user_id=user_auth.id, role=user_auth.role)
    return response

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def logout(request):
    """
    Déconnecte l'utilisateur en supprimant son token.
    """
    token_key = request.COOKIES.get(settings.AUTH_TOKEN_COOKIE_NAME)
    if token_key:
        Token.objects.filter(key=token_key).delete()

    auth_header = str(request.META.get('HTTP_AUTHORIZATION', '') or '').strip()
    if auth_header.lower().startswith('token '):
        header_token = auth_header.split(' ', 1)[1].strip()
        if header_token:
            Token.objects.filter(key=header_token).delete()

    response = Response({'message': 'Déconnecté'}, status=status.HTTP_200_OK)
    response.delete_cookie(settings.AUTH_TOKEN_COOKIE_NAME, path='/')

    if getattr(request.user, 'is_authenticated', False):
        Token.objects.filter(user=request.user).delete()
    audit_security_event('auth.logout', request)
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    audit_security_event('auth.me', request, user_id=user.id, role=getattr(user, 'role', None))
    return Response(
        {
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'role': getattr(user, 'role', ''),
            'is_active': user.is_active,
        },
        status=status.HTTP_200_OK,
    )

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetRateThrottle])
def request_reset(request):
    """
    Génère un code de réinitialisation pour un utilisateur.
    Le code est stocké dans le cache pendant 15 minutes.
    """
    email = request.data.get('email')
    
    if not email:
        audit_security_event('auth.password_reset.request.invalid', request, reason='missing_email')
        return Response({'error': 'Email requis'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = CustomUser.objects.get(email=email)
    except CustomUser.DoesNotExist:
        # Pour des raisons de sécurité, on ne révèle pas si l'email existe
        audit_security_event('auth.password_reset.request.unknown_email', request, email=email)
        return Response({'message': 'Si cet email existe, un code a été généré'}, status=status.HTTP_200_OK)
    
    # Génère un code aléatoire de 6 chiffres
    reset_code = get_random_string(length=6, allowed_chars='0123456789')
    
    # Stocke le code dans le cache avec l'email comme clé (expire dans 15 minutes)
    cache_key = f'password_reset_{email}'
    cache.set(cache_key, reset_code, 900)  # 900 secondes = 15 minutes
    audit_security_event('auth.password_reset.request.created', request, email=email, user_id=user.id)
    
    response_payload = {'message': 'Code de réinitialisation généré'}

    # Compatibilité locale: exposer le code uniquement si explicitement autorisé.
    # Ne jamais activer cette option en production.
    if os.getenv('DJANGO_EXPOSE_RESET_CODE_IN_RESPONSE', 'false').strip().lower() in ('1', 'true', 'yes', 'on'):
        response_payload['code'] = reset_code
        logger.warning('Reset code exposé en réponse API car DJANGO_EXPOSE_RESET_CODE_IN_RESPONSE=true')

    return Response(response_payload, status=status.HTTP_200_OK)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetRateThrottle])
def reset_password(request):
    """
    Réinitialise le mot de passe avec le code fourni.
    """
    email = request.data.get('email')
    token = request.data.get('token')
    new_password = request.data.get('new_password')
    
    if not all([email, token, new_password]):
        audit_security_event('auth.password_reset.confirm.invalid', request, reason='missing_fields')
        return Response({'error': 'Tous les champs sont requis'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Vérifie le code
    cache_key = f'password_reset_{email}'
    stored_code = cache.get(cache_key)
    
    if not stored_code or stored_code != token:
        audit_security_event('auth.password_reset.confirm.failed', request, email=email, reason='invalid_or_expired_code')
        return Response({'error': 'Code invalide ou expiré'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = CustomUser.objects.get(email=email)
        try:
            validate_password(new_password, user=user)
        except ValidationError as ve:
            audit_security_event('auth.password_reset.confirm.failed', request, email=email, user_id=user.id, reason='weak_password')
            return Response({'error': ' '.join(ve.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        Token.objects.filter(user=user).delete()
        
        # Supprime le code du cache
        cache.delete(cache_key)
        audit_security_event('auth.password_reset.confirm.success', request, email=email, user_id=user.id)
        
        return Response({'message': 'Mot de passe réinitialisé avec succès'}, status=status.HTTP_200_OK)
    except CustomUser.DoesNotExist:
        audit_security_event('auth.password_reset.confirm.failed', request, email=email, reason='user_not_found')
        return Response({'error': 'Utilisateur non trouvé'}, status=status.HTTP_404_NOT_FOUND)


