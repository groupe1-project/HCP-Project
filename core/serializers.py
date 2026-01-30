from rest_framework import serializers
from .models import Theme, SousTheme, Indicateur, Donnee

class SousThemeSerializer(serializers.ModelSerializer):
    # Champs calculés dynamiquement pour le frontend
    data = serializers.SerializerMethodField()
    columns = serializers.SerializerMethodField()
    # On utilise directement le champ du modèle s'il est déjà en JSON
    charts_config = serializers.JSONField()

    class Meta:
        model = SousTheme
        fields = ['id', 'nom', 'ordre', 'data', 'columns', 'charts_config']

    def get_data(self, obj):
        # Retourne le contenu JSON des données Excel
        return obj.data_json or []

    def get_columns(self, obj):
        # Extrait les noms des colonnes à partir du premier dictionnaire de data_json
        if obj.data_json and isinstance(obj.data_json, list) and len(obj.data_json) > 0:
            return list(obj.data_json[0].keys())
        return []

class ThemeSerializer(serializers.ModelSerializer):
    # Relation vers les sous-thèmes
    sous_themes = SousThemeSerializer(many=True, read_only=True)

    class Meta:
        model = Theme
        fields = [
            'id', 
            'titre', 
            'ordre', 
            'is_visible', 
            'statut', 
            'sous_themes',
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