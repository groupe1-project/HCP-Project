from rest_framework import serializers
from .models import Theme, SousTheme, Indicateur, Donnee, CustomUser, Categorie

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'role']
        read_only_fields = ['username', 'role']

class SousThemeSerializer(serializers.ModelSerializer):
    # Champs calculés dynamiquement pour le frontend
    data = serializers.SerializerMethodField()
    columns = serializers.SerializerMethodField()
    # On expose également le champ data_json pour permettre les écritures depuis le front
    data_json = serializers.JSONField(required=False, allow_null=True)
    # On utilise directement le champ du modèle s'il est déjà en JSON
    charts_config = serializers.JSONField()

    class Meta:
        model = SousTheme
        fields = [
            'id', 'nom', 'ordre', 'is_visible', 'archived', 'categorie', 'data', 'data_json', 'columns', 'charts_config',
            # Métadonnées éditables côté front
            'definition_text', 'unite_text', 'indication_text', 'source_text', 'periodicite_text', 'couverture_text'
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