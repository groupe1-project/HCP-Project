from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
from django.utils.crypto import get_random_string
from django.core.cache import cache
from .models import CustomUser

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    Authentifie un utilisateur via email et mot de passe.
    Retourne un token d'authentification.
    """
    email = request.data.get('email')
    password = request.data.get('password')

    if not email or not password:
        return Response({'error': 'Email et mot de passe requis'}, status=status.HTTP_400_BAD_REQUEST)

    # Cherche l'utilisateur par email
    try:
        user = CustomUser.objects.get(email=email)
    except CustomUser.DoesNotExist:
        return Response({'error': 'Utilisateur non trouvé'}, status=status.HTTP_401_UNAUTHORIZED)

    # Authentifie avec le mot de passe (utilise username pour authenticate)
    user_auth = authenticate(username=user.username, password=password)
    if user_auth is None:
        return Response({'error': 'Mot de passe incorrect'}, status=status.HTTP_401_UNAUTHORIZED)

    # Génère ou récupère le token
    token, created = Token.objects.get_or_create(user=user_auth)

    return Response({
        'token': token.key,
        'user_id': user_auth.id,
        'username': user_auth.username,
        'email': user_auth.email,
        'role': user_auth.role,
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
def logout(request):
    """
    Déconnecte l'utilisateur en supprimant son token.
    """
    if request.user.is_authenticated:
        Token.objects.filter(user=request.user).delete()
        return Response({'message': 'Déconnecté'}, status=status.HTTP_200_OK)
    return Response({'error': 'Non authentifié'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
@permission_classes([AllowAny])
def request_reset(request):
    """
    Génère un code de réinitialisation pour un utilisateur.
    Le code est stocké dans le cache pendant 15 minutes.
    """
    email = request.data.get('email')
    
    if not email:
        return Response({'error': 'Email requis'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = CustomUser.objects.get(email=email)
    except CustomUser.DoesNotExist:
        # Pour des raisons de sécurité, on ne révèle pas si l'email existe
        return Response({'message': 'Si cet email existe, un code a été généré'}, status=status.HTTP_200_OK)
    
    # Génère un code aléatoire de 6 chiffres
    reset_code = get_random_string(length=6, allowed_chars='0123456789')
    
    # Stocke le code dans le cache avec l'email comme clé (expire dans 15 minutes)
    cache_key = f'password_reset_{email}'
    cache.set(cache_key, reset_code, 900)  # 900 secondes = 15 minutes
    
    # En production, vous enverriez ce code par email
    # Pour le développement, on le retourne (à supprimer en production)
    print(f'Code de réinitialisation pour {email}: {reset_code}')
    
    return Response({
        'message': 'Code de réinitialisation généré',
        'code': reset_code  # À supprimer en production !
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """
    Réinitialise le mot de passe avec le code fourni.
    """
    email = request.data.get('email')
    token = request.data.get('token')
    new_password = request.data.get('new_password')
    
    if not all([email, token, new_password]):
        return Response({'error': 'Tous les champs sont requis'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Vérifie le code
    cache_key = f'password_reset_{email}'
    stored_code = cache.get(cache_key)
    
    if not stored_code or stored_code != token:
        return Response({'error': 'Code invalide ou expiré'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = CustomUser.objects.get(email=email)
        user.set_password(new_password)
        user.save()
        
        # Supprime le code du cache
        cache.delete(cache_key)
        
        return Response({'message': 'Mot de passe réinitialisé avec succès'}, status=status.HTTP_200_OK)
    except CustomUser.DoesNotExist:
        return Response({'error': 'Utilisateur non trouvé'}, status=status.HTTP_404_NOT_FOUND)


