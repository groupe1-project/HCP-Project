from django.db import models
from django.contrib.auth.models import AbstractUser

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

class SousTheme(models.Model):
    nom = models.CharField(max_length=200)
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE, related_name='sous_themes')
    ordre = models.IntegerField(default=0)

    # Visibilité (Public / Privé) pour le sous-thème
    is_visible = models.BooleanField(default=True)
    
    # Marque d'archivage (archive vs actif)
    archived = models.BooleanField(default=False)
    
    # Stockage des données Excel (votre logique actuelle)
    data_json = models.JSONField(null=True, blank=True) 
    
    # Stockage des graphiques configurés (utilisé par le Front)
    charts_config = models.JSONField(default=list, blank=True)

    # Métadonnées textuelles pour chaque sous-thème (édition via le Front)
    definition_text = models.TextField(null=True, blank=True)
    unite_text = models.TextField(null=True, blank=True)
    indication_text = models.TextField(null=True, blank=True)
    source_text = models.TextField(null=True, blank=True)
    periodicite_text = models.TextField(null=True, blank=True)
    couverture_text = models.TextField(null=True, blank=True)

    # Pour faciliter la lecture des colonnes dynamiques au Front
    @property
    def columns(self):
        if self.data_json and len(self.data_json) > 0:
            return list(self.data_json[0].keys())
        return []

    def __str__(self):
        return f"{self.theme.titre} > {self.nom}"

# 3. LES INDICATEURS (Inchangé)
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