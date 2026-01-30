from rest_framework import serializers
from .models import Theme, SousTheme, Indicateur, Donnee

class SousThemeSerializer(serializers.ModelSerializer):
    # Champs calculés pour le frontend React
    data = serializers.SerializerMethodField()
    columns = serializers.SerializerMethodField()

    class Meta:
        model = SousTheme
        fields = ['id', 'nom', 'ordre', 'data', 'columns']

    def get_data(self, obj):
        """
        Renvoie le contenu brut du fichier Excel stocké en JSON.
        Si aucune donnée n'est présente, renvoie une liste vide.
        """
        return obj.data_json or []

    def get_columns(self, obj):
        """
        Génère dynamiquement les entêtes de colonnes à partir des clés 
        du premier dictionnaire trouvé dans data_json.
        """
        if obj.data_json and len(obj.data_json) > 0:
            # On récupère les clés du premier dictionnaire de la liste
            # Exemple: si l'Excel avait "Année" et "Valeur", il renverra ["Année", "Valeur"]
            return list(obj.data_json[0].keys())
        return []

class ThemeSerializer(serializers.ModelSerializer):
    # On inclut les sous-thèmes liés avec leur nouveau format de données
    sous_themes = SousThemeSerializer(many=True, read_only=True)

    class Meta:
        model = Theme
        fields = ['id', 'titre', 'ordre', 'is_visible', 'sous_themes']

class IndicateurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Indicateur
        fields = '__all__'

class DonneeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Donnee
        fields = '__all__'