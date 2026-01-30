from django.db import models
from django.contrib.auth.models import AbstractUser

# 1. Gestion des Utilisateurs et Rôles
class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('ADMIN', 'Administrateur'),
        ('SAISISSEUR', 'Saisisseur'),
        ('AVANCE', 'Saisisseur Avancé'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='SAISISSEUR')

    def __str__(self):
        return f"{self.username} ({self.role})"

# 2. Structure des Thématiques
class Theme(models.Model):
    titre = models.CharField(max_length=200)
    ordre = models.IntegerField(default=0)
    is_visible = models.BooleanField(default=True)

    def __str__(self):
        return self.titre

class SousTheme(models.Model):
    nom = models.CharField(max_length=200)
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE, related_name='sous_themes')
    ordre = models.IntegerField(default=0)
    
    # --- AJOUT CLÉ ---
    # Ce champ permet de stocker le tableau Excel complet sous forme de liste JSON.
    # C'est ce qui permettra d'afficher exactement les colonnes du fichier importé.
    data_json = models.JSONField(null=True, blank=True) 

    def __str__(self):
        return f"{self.theme.titre} > {self.nom}"

# 3. Les Indicateurs
class Indicateur(models.Model):
    libelle = models.CharField(max_length=300)
    unite = models.CharField(max_length=50)
    theme = models.ForeignKey(Theme, on_delete=models.SET_NULL, null=True, blank=True, related_name='indicateurs_directs')
    soustheme = models.ForeignKey(SousTheme, on_delete=models.SET_NULL, null=True, blank=True, related_name='indicateurs')
    is_published = models.BooleanField(default=False)

    def __str__(self):
        return self.libelle

# 4. Les Données (Utilisées pour la validation individuelle si nécessaire)
class Donnee(models.Model):
    STATUT_CHOICES = (
        ('PENDING', 'En attente'),
        ('VALIDATED', 'Validé'),
        ('REJECTED', 'Rejeté'),
    )
    valeur = models.DecimalField(max_digits=15, decimal_places=2)
    date_saisie = models.DateTimeField(auto_now_add=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='PENDING')
    indicateur = models.ForeignKey(Indicateur, on_delete=models.CASCADE, related_name='valeurs')
    saisisseur = models.ForeignKey(CustomUser, on_delete=models.PROTECT)
    motif_refus = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.indicateur.libelle}: {self.valeur} ({self.statut})"

# 5. Métadonnées
class Metadata(models.Model):
    donnee = models.OneToOneField(Donnee, on_delete=models.CASCADE, related_name='metadata')
    source = models.CharField(max_length=255)
    methode_calcul = models.TextField()
    periodicite = models.CharField(max_length=100)