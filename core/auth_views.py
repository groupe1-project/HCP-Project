from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
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

