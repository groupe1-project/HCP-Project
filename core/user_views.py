from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.mail import send_mail
from .models import CustomUser
from .serializers import UserSerializer
import random
import string

def generate_password(length=8):
    """Génère un mot de passe aléatoire"""
    chars = string.ascii_letters + string.digits + '!@#$%'
    return ''.join(random.choice(chars) for _ in range(length))

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les utilisateurs.
    Permet de mettre à jour l'email et le mot de passe.
    """
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def update(self, request, *args, **kwargs):
        """
        Met à jour l'email et/ou le mot de passe de l'utilisateur.
        """
        user = self.get_object()
        
        # Seul l'utilisateur lui-même peut modifier son compte
        if user.id != request.user.id:
            return Response({'error': 'Non autorisé'}, status=status.HTTP_403_FORBIDDEN)
        
        email = request.data.get('email')
        password = request.data.get('password')
        
        if email:
            user.email = email
        
        if password:
            user.set_password(password)
        
        user.save()
        
        serializer = self.get_serializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Réinitialise le mot de passe d'un utilisateur (admin uniquement)"""
        if request.user.role != 'ADMIN':
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
        
        user = self.get_object()
        
        # Générer un nouveau mot de passe
        new_password = generate_password()
        user.set_password(new_password)
        user.save()
        
        # Envoyer l'email
        subject = "Votre mot de passe a été réinitialisé"
        message = f"""
Bonjour {user.first_name or user.username},

Votre mot de passe a été réinitialisé par un administrateur.

Vos nouveaux identifiants :
- Email/Identifiant : {user.email}
- Nouveau mot de passe : {new_password}

Veuillez vous connecter et modifier votre mot de passe.

Cordialement,
L'équipe HCP
"""
        
        try:
            send_mail(
                subject,
                message,
                'noreply@hcp.ma',
                [user.email],
                fail_silently=False,
            )
        except Exception as e:
            return Response({'error': f'Erreur lors de l\'envoi de l\'email: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({
            'message': 'Mot de passe réinitialisé avec succès',
            'password': new_password
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Archive un utilisateur (admin uniquement)"""
        if request.user.role != 'ADMIN':
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
        
        user = self.get_object()
        user.is_active = False
        user.save()
        
        return Response({'message': 'Utilisateur archivé avec succès'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def unarchive(self, request, pk=None):
        """Réactive un utilisateur archivé (admin uniquement)"""
        if request.user.role != 'ADMIN':
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)

        user = self.get_object()
        user.is_active = True
        user.save()

        return Response({'message': 'Utilisateur réactivé avec succès'}, status=status.HTTP_200_OK)
    
    def destroy(self, request, *args, **kwargs):
        """Supprime un utilisateur (admin uniquement)"""
        if request.user.role != 'ADMIN':
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
        
        return super().destroy(request, *args, **kwargs)
