from rest_framework import serializers
from .models import Theme, SousTheme, Indicateur, Donnee, CustomUser, Categorie, UserThemeAssignment, UserRequest

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'role', 'is_active']
        read_only_fields = ['username', 'role', 'is_active']

class SousThemeSerializer(serializers.ModelSerializer):
    # Champs calculés dynamiquement pour le frontend
    data = serializers.SerializerMethodField()
    columns = serializers.SerializerMethodField()
    # On expose également le champ data_json pour permettre les écritures depuis le front
    data_json = serializers.JSONField(required=False, allow_null=True)
    # On utilise directement le champ du modèle s'il est déjà en JSON
    charts_config = serializers.JSONField()
    # Nouveaux champs pour analyse dynamique
    filtres_disponibles = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = SousTheme
        fields = [
            'id', 'nom', 'ordre', 'is_visible', 'archived', 'categorie', 'data', 'data_json', 'columns', 'charts_config',
            # Métadonnées éditables côté front
            'definition_text', 'unite_text', 'indication_text', 'source_text', 'periodicite_text', 'couverture_text',
            # Nouveaux champs
            'niveau_geo', 'type_unite', 'est_sommable', 'filtres_disponibles'
        ]

    def get_data(self, obj):
        # Retourne le contenu JSON des données Excel
        return obj.data_json or []

    def get_columns(self, obj):
        # Extrait les noms des colonnes à partir du premier dictionnaire de data_json
        if obj.data_json and isinstance(obj.data_json, list) and len(obj.data_json) > 0:
            return list(obj.data_json[0].keys())
        return []

class CategorieSerializer(serializers.ModelSerializer):
    sous_themes = SousThemeSerializer(many=True, read_only=True)
    
    class Meta:
        model = Categorie
        fields = ['id', 'nom', 'ordre', 'theme', 'sous_themes', 'is_visible']

class ThemeSerializer(serializers.ModelSerializer):
    # Relation vers les sous-thèmes
    sous_themes = SousThemeSerializer(many=True, read_only=True)
    # Relation vers les catégories
    categories = CategorieSerializer(many=True, read_only=True)

    class Meta:
        model = Theme
        fields = [
            'id', 
            'titre', 
            'ordre', 
            'is_visible', 
            'archived',
            'statut', 
            'sous_themes',
            'categories',
            # Ajout des nouveaux champs de métadonnées pour le Front-end
            'definition_text',
            'unite_text',
            'indication_text',
            'source_text',
            'periodicite_text'
        ]

class IndicateurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Indicateur
        fields = '__all__'

class DonneeSerializer(serializers.ModelSerializer):
    # Optionnel : On peut ajouter le nom de l'indicateur pour plus de clarté
    indicateur_nom = serializers.ReadOnlyField(source='indicateur.libelle')
    
    class Meta:
        model = Donnee
        fields = '__all__'

class UserThemeAssignmentSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')
    user_email = serializers.ReadOnlyField(source='user.email')
    user_role = serializers.ReadOnlyField(source='user.role')
    user_is_active = serializers.ReadOnlyField(source='user.is_active')
    theme_titre = serializers.ReadOnlyField(source='theme.titre')
    sous_theme_nom = serializers.ReadOnlyField(source='sous_theme.nom')
    indicateur_libelle = serializers.ReadOnlyField(source='indicateur.libelle')
    
    class Meta:
        model = UserThemeAssignment
        fields = [
            'id', 'user', 'user_name', 'user_email', 'user_role', 'user_is_active',
            'theme', 'theme_titre', 'sous_theme', 'sous_theme_nom',
            'indicateur', 'indicateur_libelle', 'statut',
            'date_assignation', 'date_modification', 'date_completion',
            'notes', 'progression', 'priorite'
        ]

class UserRequestSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    
    class Meta:
        model = UserRequest
        fields = [
            'id', 'requester_email', 'requester_name', 'requested_role',
            'statut', 'demande_texte', 'date_creation', 'date_modification',
            'created_by', 'created_by_name'
        ]