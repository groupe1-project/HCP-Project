from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import CustomUser
from .serializers import UserSerializer

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
