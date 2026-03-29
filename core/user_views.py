from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.mail import send_mail
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework.authtoken.models import Token
from .models import CustomUser
from .serializers import UserSerializer
from .security_audit import audit_security_event
import secrets
import string

def generate_password(length=14):
    """Genere un mot de passe robuste avec complexite minimale."""
    if length < 12:
        length = 12

    lower = string.ascii_lowercase
    upper = string.ascii_uppercase
    digits = string.digits
    specials = '!@#$%^&*()-_=+[]{}'
    all_chars = lower + upper + digits + specials

    # Guarantee at least one char from each category.
    required = [
        secrets.choice(lower),
        secrets.choice(upper),
        secrets.choice(digits),
        secrets.choice(specials),
    ]
    remaining = [secrets.choice(all_chars) for _ in range(length - len(required))]
    chars = required + remaining
    secrets.SystemRandom().shuffle(chars)
    return ''.join(chars)

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les utilisateurs.
    Permet de mettre à jour l'email et le mot de passe.
    """
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def _is_admin(self, user):
        return bool(user and (user.is_superuser or getattr(user, 'role', None) == 'ADMIN'))

    def get_queryset(self):
        if self._is_admin(self.request.user):
            return CustomUser.objects.all()
        return CustomUser.objects.filter(id=self.request.user.id)

    def create(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            audit_security_event('admin.user.create.denied', request)
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
        audit_security_event('admin.user.create.requested', request)
        return super().create(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        """
        Met à jour l'email et/ou le mot de passe de l'utilisateur.
        """
        user = self.get_object()
        
        # Seul l'utilisateur lui-même peut modifier son compte
        if user.id != request.user.id:
            audit_security_event('user.profile.update.denied', request, target_user_id=user.id)
            return Response({'error': 'Non autorisé'}, status=status.HTTP_403_FORBIDDEN)
        
        email = request.data.get('email')
        password = request.data.get('password')
        
        if email:
            user.email = email
        
        if password:
            try:
                validate_password(password, user=user)
            except ValidationError as ve:
                audit_security_event('user.profile.password_change.failed', request, target_user_id=user.id, reason='weak_password')
                return Response({'error': ' '.join(ve.messages)}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(password)
            Token.objects.filter(user=user).delete()
        
        user.save()
        
        serializer = self.get_serializer(user)
        audit_security_event('user.profile.update.success', request, target_user_id=user.id)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Réinitialise le mot de passe d'un utilisateur (admin uniquement)"""
        # Allow Django superusers as well as users with role 'ADMIN'
        if not (request.user.role == 'ADMIN' or request.user.is_superuser):
            audit_security_event('admin.user.reset_password.denied', request, target_user_id=pk)
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
        
        user = self.get_object()
        
        # Générer un nouveau mot de passe
        new_password = generate_password()
        user.set_password(new_password)
        user.save()
        Token.objects.filter(user=user).delete()
        
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
            audit_security_event('admin.user.reset_password.failed', request, target_user_id=user.id, reason='email_send_error')
            return Response({'error': f'Erreur lors de l\'envoi de l\'email: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        audit_security_event('admin.user.reset_password.success', request, target_user_id=user.id)
        
        return Response({
            'message': 'Mot de passe réinitialisé avec succès'
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Archive un utilisateur (admin uniquement)"""
        # Allow Django superusers as well as users with role 'ADMIN'
        if not (request.user.role == 'ADMIN' or request.user.is_superuser):
            audit_security_event('admin.user.archive.denied', request, target_user_id=pk)
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
        
        user = self.get_object()
        user.is_active = False
        user.save()
        audit_security_event('admin.user.archive.success', request, target_user_id=user.id)
        
        return Response({'message': 'Utilisateur archivé avec succès'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def unarchive(self, request, pk=None):
        """Réactive un utilisateur archivé (admin uniquement)"""
        # Allow Django superusers as well as users with role 'ADMIN'
        if not (request.user.role == 'ADMIN' or request.user.is_superuser):
            audit_security_event('admin.user.unarchive.denied', request, target_user_id=pk)
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)

        user = self.get_object()
        user.is_active = True
        user.save()
        audit_security_event('admin.user.unarchive.success', request, target_user_id=user.id)

        return Response({'message': 'Utilisateur réactivé avec succès'}, status=status.HTTP_200_OK)
    
    def destroy(self, request, *args, **kwargs):
        """Supprime un utilisateur (admin uniquement)"""
        # Allow Django superusers as well as users with role 'ADMIN'
        if not (request.user.role == 'ADMIN' or request.user.is_superuser):
            audit_security_event('admin.user.delete.denied', request, target_user_id=kwargs.get('pk'))
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
        audit_security_event('admin.user.delete.requested', request, target_user_id=kwargs.get('pk'))
        
        return super().destroy(request, *args, **kwargs)
