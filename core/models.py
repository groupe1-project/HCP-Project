from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.base_user import BaseUserManager

# 1. GESTION DES UTILISATEURS
class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('ADMIN', 'Administrateur'),
        ('SAISISSEUR', 'Saisisseur'),
        ('AVANCE', 'Saisisseur Avancé'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='SAISISSEUR')

    def __str__(self):
        return f"{self.username} ({self.role})"


class CustomUserManager(BaseUserManager):
    """Manager personnalisé pour s'assurer que les superusers ont role='ADMIN'."""
    use_in_migrations = True

    def create_user(self, username, email=None, password=None, **extra_fields):
        if not username:
            raise ValueError('The given username must be set')
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        # Ensure role for superusers is ADMIN
        extra_fields.setdefault('role', 'ADMIN')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(username, email, password, **extra_fields)


# Attach the custom manager to the model
CustomUser.add_to_class('objects', CustomUserManager())

# 2. STRUCTURE DES THÉMATIQUES
class Theme(models.Model):
    titre = models.CharField(max_length=200)
    ordre = models.IntegerField(default=0)
    is_visible = models.BooleanField(default=True)
    # Marque d'archivage (archive vs actif)
    archived = models.BooleanField(default=False)
    statut = models.CharField(max_length=50, default='Public') # Pour correspondre au Front

    # --- AJOUT DES MÉTADONNÉES TEXTUELLES (Ce qui manquait pour le bouton Métadonnées) ---
    definition_text = models.TextField(null=True, blank=True)
    unite_text = models.TextField(null=True, blank=True)
    indication_text = models.TextField(null=True, blank=True)
    source_text = models.TextField(null=True, blank=True)
    periodicite_text = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.titre

class Categorie(models.Model):
    nom = models.CharField(max_length=200)
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE, related_name='categories')
    ordre = models.IntegerField(default=0)
    is_visible = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.theme.titre} - {self.nom}"

class SousTheme(models.Model):
    NIVEAU_GEO_CHOICES = (
        ('Régionale', 'Régionale'),
        ('Provinciale', 'Provinciale'),
        ('Communale', 'Communale'),
    )
    
    nom = models.CharField(max_length=200)
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE, related_name='sous_themes')
    # Catégorie optionnelle : si null, le sous-thème est directement sous le thème
    categorie = models.ForeignKey(Categorie, on_delete=models.CASCADE, related_name='sous_themes', null=True, blank=True)
    ordre = models.IntegerField(default=0)

    # Visibilité (Public / Privé) pour le sous-thème
    is_visible = models.BooleanField(default=True)
    
    # Marque d'archivage (archive vs actif)
    archived = models.BooleanField(default=False)
    
    # Stockage des données Excel (votre logique actuelle)
    data_json = models.JSONField(null=True, blank=True) 
    
    # Ordre des colonnes pour préserver l'ordre du fichier Excel original
    columns_order = models.JSONField(default=list, blank=True, help_text="Liste ordonnée des noms de colonnes du fichier Excel")
    
    # Stockage des graphiques configurés (utilisé par le Front)
    charts_config = models.JSONField(default=list, blank=True)

    # Métadonnées textuelles pour chaque sous-thème (édition via le Front)
    definition_text = models.TextField(null=True, blank=True)
    unite_text = models.TextField(null=True, blank=True)
    indication_text = models.TextField(null=True, blank=True)
    source_text = models.TextField(null=True, blank=True)
    periodicite_text = models.TextField(null=True, blank=True)
    couverture_text = models.TextField(null=True, blank=True)
    
    # Nouveaux champs pour analyse dynamique et graphiques intelligents
    # 1. Granularité géographique
    niveau_geo = models.CharField(max_length=20, choices=NIVEAU_GEO_CHOICES, null=True, blank=True)
    
    # 2. Nature de l'indicateur
    type_unite = models.CharField(max_length=100, null=True, blank=True, help_text="Ex: '%', 'Effectif', 'DH', 'Km'")
    est_sommable = models.BooleanField(default=True, help_text="Si Vrai, on peut additionner les données. Si Faux, on calcule des moyennes.")
    
    # 3. Dictionnaire de variables pour les filtres disponibles
    filtres_disponibles = models.JSONField(default=list, blank=True, help_text="Liste des colonnes sur lesquelles on peut filtrer")

    # --- Paramètres spécifiques à l'affichage visiteur (configurables par les admins) ---
    # Colonnes visibles pour le visiteur (liste de noms de colonnes)
    visitor_visible_columns = models.JSONField(default=list, blank=True, help_text="Colonnes visibles pour le mode visiteur")
    # Filtres que le visiteur peut appliquer
    visitor_filters = models.JSONField(default=list, blank=True, help_text="Filtres disponibles pour le visiteur")
    # Filtres par défaut appliqués pour le visiteur (ex: {"Milieu": "Total"} ou "Total")
    visitor_default_filters = models.JSONField(default=dict, blank=True, help_text="Filtres par défaut pour le visiteur")

    # Colonnes que le visiteur peut pivoter / transposer (ex: pour tableaux croisés)
    visitor_pivot_columns = models.JSONField(default=list, blank=True, help_text="Colonnes que le visiteur peut pivoter/transposer")

    # Pour faciliter la lecture des colonnes dynamiques au Front
    @property
    def columns(self):
        # Utiliser columns_order si disponible (ordre préservé de l'Excel original)
        if self.columns_order and len(self.columns_order) > 0:
            return self.columns_order
        # Sinon extraire du first record (fallback)
        if self.data_json and len(self.data_json) > 0:
            return list(self.data_json[0].keys())
        return []

    def __str__(self):
        return f"{self.theme.titre} > {self.nom}"

# 3. LES INDICATEURS (Inchangé)
class UserThemeAssignment(models.Model):
    """Assignation de thèmes/sous-thèmes aux saisisseurs"""
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='theme_assignments')
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE, null=True, blank=True)
    sous_theme = models.ForeignKey(SousTheme, on_delete=models.CASCADE, null=True, blank=True)
    indicateur = models.ForeignKey('Indicateur', on_delete=models.CASCADE, null=True, blank=True)
    statut = models.CharField(max_length=50, default='En cours', choices=[
        ('En cours', 'En cours'),
        ('Complété', 'Complété'),
        ('En attente', 'En attente'),
    ])
    date_assignation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    date_completion = models.DateTimeField(null=True, blank=True, help_text="Date de complétion de la tâche")
    notes = models.TextField(null=True, blank=True, help_text="Notes ou commentaires sur la tâche")
    progression = models.IntegerField(default=0, help_text="Pourcentage de progression (0-100)")
    priorite = models.CharField(max_length=20, default='Normale', choices=[
        ('Basse', 'Basse'),
        ('Normale', 'Normale'),
        ('Haute', 'Haute'),
    ])
    
    class Meta:
        unique_together = [['user', 'theme', 'sous_theme', 'indicateur']]
    
    def __str__(self):
        return f"{self.user.username} - {self.theme or self.sous_theme or self.indicateur}"

class UserRequest(models.Model):
    """Demandes de création d'utilisateur"""
    STATUS_CHOICES = (
        ('Nouveau', 'Nouveau'),
        ('En attente', 'En attente'),
        ('Approuvé', 'Approuvé'),
        ('Rejeté', 'Rejeté'),
    )
    
    requester_email = models.EmailField()
    requester_name = models.CharField(max_length=255)
    requested_role = models.CharField(max_length=20, choices=CustomUser.ROLE_CHOICES)
    statut = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Nouveau')
    demande_texte = models.TextField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='user_requests_created')
    
    def __str__(self):
        return f"Demande de {self.requester_email} ({self.requested_role})"

class Indicateur(models.Model):
    libelle = models.CharField(max_length=300)
    unite = models.CharField(max_length=50)
    theme = models.ForeignKey(Theme, on_delete=models.SET_NULL, null=True, blank=True, related_name='indicateurs_directs')
    soustheme = models.ForeignKey(SousTheme, on_delete=models.SET_NULL, null=True, blank=True, related_name='indicateurs')
    is_published = models.BooleanField(default=False)

    def __str__(self):
        return self.libelle

# 4. LES DONNÉES (Inchangé - Pour la saisie manuelle)
class Donnee(models.Model):
    STATUT_CHOICES = (('PENDING', 'En attente'), ('VALIDATED', 'Validé'), ('REJECTED', 'Rejeté'))
    valeur = models.DecimalField(max_digits=15, decimal_places=2)
    date_saisie = models.DateTimeField(auto_now_add=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='PENDING')
    indicateur = models.ForeignKey(Indicateur, on_delete=models.CASCADE, related_name='valeurs')
    saisisseur = models.ForeignKey(CustomUser, on_delete=models.PROTECT)
    motif_refus = models.TextField(null=True, blank=True)

# 5. MÉTADONNÉES DE DONNÉE (Spécifique aux saisies manuelles)
class Metadata(models.Model):
    donnee = models.OneToOneField(Donnee, on_delete=models.CASCADE, related_name='metadata')
    source = models.CharField(max_length=255)
    methode_calcul = models.TextField()
    periodicite = models.CharField(max_length=100)