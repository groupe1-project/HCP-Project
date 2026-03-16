import json

from rest_framework import serializers
from .models import Theme, SousTheme, Indicateur, Donnee, CustomUser, Categorie, UserThemeAssignment, UserRequest, InfoBanner, SiteContent


def _normalize_name(value):
    """Normalize names to prevent duplicates with casing/extra spaces differences."""
    return ' '.join(str(value or '').strip().split()).lower()

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
    # Ordre des colonnes préservé de l'Excel original
    columns_order = serializers.JSONField(required=False, allow_null=True)
    # On utilise directement le champ du modèle s'il est déjà en JSON
    charts_config = serializers.JSONField()
    # Nouveaux champs pour analyse dynamique
    filtres_disponibles = serializers.JSONField(required=False, allow_null=True)
    visitor_pivot_columns = serializers.JSONField(required=False, allow_null=True)
    visitor_default_view = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = SousTheme
        fields = [
            'id', 'nom', 'ordre', 'is_visible', 'archived', 'categorie', 'data', 'data_json', 'columns_order', 'columns', 'charts_config',
            # Métadonnées éditables côté front
            'definition_text', 'unite_text', 'indication_text', 'source_text', 'periodicite_text', 'couverture_text',
            # Nouveaux champs
            'niveau_geo', 'type_unite', 'est_sommable', 'filtres_disponibles'
            , 'visitor_visible_columns', 'visitor_filters', 'visitor_default_filters', 'visitor_pivot_columns', 'visitor_default_view'
        ]

    def validate_nom(self, value):
        cleaned = ' '.join(str(value or '').strip().split())
        if not cleaned:
            raise serializers.ValidationError("Le nom du sous-theme est obligatoire.")
        return cleaned

    def validate(self, attrs):
        attrs = super().validate(attrs)

        nom = attrs.get('nom', getattr(self.instance, 'nom', None))
        theme = attrs.get('theme', getattr(self.instance, 'theme', None))

        if nom and theme:
            normalized_nom = _normalize_name(nom)
            duplicates = SousTheme.objects.filter(theme=theme)
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)

            for st in duplicates.only('id', 'nom'):
                if _normalize_name(st.nom) == normalized_nom:
                    raise serializers.ValidationError({
                        'nom': f'Un sous-theme avec ce nom existe deja pour le theme "{theme.titre}".'
                    })

        return attrs

    def to_representation(self, instance):
        # Use default representation then include visitor fields if present on the instance
        rep = super().to_representation(instance)
        # Add visitor fields (may be new)
        try:
            rep['visitor_visible_columns'] = instance.visitor_visible_columns or []
        except Exception:
            rep['visitor_visible_columns'] = []
        try:
            rep['visitor_filters'] = instance.visitor_filters or []
        except Exception:
            rep['visitor_filters'] = []
        try:
            rep['visitor_default_filters'] = instance.visitor_default_filters or {}
        except Exception:
            rep['visitor_default_filters'] = {}
        try:
            rep['visitor_pivot_columns'] = instance.visitor_pivot_columns or []
        except Exception:
            rep['visitor_pivot_columns'] = []
        try:
            rep['visitor_default_view'] = instance.visitor_default_view or 'horizontal'
        except Exception:
            rep['visitor_default_view'] = 'horizontal'
        return rep

    def get_data(self, obj):
        # Retourne le contenu JSON des données Excel
        return obj.data_json or []

    def get_columns(self, obj):
        # Utiliser columns_order si disponible (ordre préservé de l'Excel original)
        if obj.columns_order and len(obj.columns_order) > 0:
            return obj.columns_order
        # Sinon extraire du first record (fallback)
        if obj.data_json and isinstance(obj.data_json, list) and len(obj.data_json) > 0:
            return list(obj.data_json[0].keys())
        return []

class CategorieSerializer(serializers.ModelSerializer):
    sous_themes = SousThemeSerializer(many=True, read_only=True)

    def validate_nom(self, value):
        cleaned = ' '.join(str(value or '').strip().split())
        if not cleaned:
            raise serializers.ValidationError("Le nom de la categorie est obligatoire.")
        return cleaned

    def validate(self, attrs):
        attrs = super().validate(attrs)

        nom = attrs.get('nom', getattr(self.instance, 'nom', None))
        theme = attrs.get('theme', getattr(self.instance, 'theme', None))

        if nom and theme:
            normalized_nom = _normalize_name(nom)
            duplicates = Categorie.objects.filter(theme=theme)
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)

            for categorie in duplicates.only('id', 'nom'):
                if _normalize_name(categorie.nom) == normalized_nom:
                    raise serializers.ValidationError({
                        'nom': f'Une categorie avec ce nom existe deja pour le theme "{theme.titre}".'
                    })

        return attrs
    
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
            'theme_image',
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

    def validate_titre(self, value):
        cleaned = ' '.join(str(value or '').strip().split())
        if not cleaned:
            raise serializers.ValidationError("Le titre du theme est obligatoire.")
        return cleaned

    def validate(self, attrs):
        attrs = super().validate(attrs)

        titre = attrs.get('titre', getattr(self.instance, 'titre', None))
        if titre:
            normalized_titre = _normalize_name(titre)
            duplicates = Theme.objects.all()
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)

            for theme in duplicates.only('id', 'titre'):
                if _normalize_name(theme.titre) == normalized_titre:
                    raise serializers.ValidationError({
                        'titre': 'Un theme avec ce nom existe deja.'
                    })

        return attrs

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
    assignment_archived = serializers.SerializerMethodField()

    def get_assignment_archived(self, obj):
        raw_notes = obj.notes
        if not raw_notes:
            return False
        if isinstance(raw_notes, dict):
            return bool(raw_notes.get('assignment_archived', False))
        try:
            parsed = json.loads(raw_notes)
            if isinstance(parsed, dict):
                return bool(parsed.get('assignment_archived', False))
        except Exception:
            return False
        return False
    
    class Meta:
        model = UserThemeAssignment
        fields = [
            'id', 'user', 'user_name', 'user_email', 'user_role', 'user_is_active',
            'theme', 'theme_titre', 'sous_theme', 'sous_theme_nom',
            'indicateur', 'indicateur_libelle', 'statut',
            'date_assignation', 'date_modification', 'date_completion',
            'notes', 'progression', 'priorite', 'assignment_archived'
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


class InfoBannerSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.ReadOnlyField(source='updated_by.username')

    class Meta:
        model = InfoBanner
        fields = ['id', 'message', 'updated_at', 'updated_by', 'updated_by_name']
        read_only_fields = ['updated_at', 'updated_by', 'updated_by_name']


class SiteContentSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.ReadOnlyField(source='updated_by.username')

    class Meta:
        model = SiteContent
        fields = [
            'id',
            'about_title',
            'about_text',
            'contact_title',
            'contact_email',
            'contact_phone',
            'contact_address',
            'contact_hours',
            'useful_links',
            'updated_at',
            'updated_by',
            'updated_by_name',
        ]
        read_only_fields = ['updated_at', 'updated_by', 'updated_by_name']
        extra_kwargs = {
            'about_title': {'required': False, 'allow_blank': True},
            'about_text': {'required': False, 'allow_blank': True},
            'contact_title': {'required': False, 'allow_blank': True},
            'contact_email': {'required': False, 'allow_blank': True},
            'contact_phone': {'required': False, 'allow_blank': True},
            'contact_address': {'required': False, 'allow_blank': True},
            'contact_hours': {'required': False, 'allow_blank': True},
            'useful_links': {'required': False},
        }