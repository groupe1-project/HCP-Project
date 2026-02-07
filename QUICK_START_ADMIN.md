# Quick Start - Espace Administrateur

## 1. Préparation de l'Environnement

### Appliquer les Migrations
```bash
cd c:\Users\pc\Desktop\PROJET_DATA
.\venv\Scripts\activate
python manage.py makemigrations
python manage.py migrate
```

### Redémarrer le serveur Django
```bash
python manage.py runserver
```

## 2. Configurer l'Email (Important!)

### Fichier: `backend/settings.py`

**Pour le développement (console):**
```python
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

**Pour la production:**
```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'votre-email@gmail.com'
EMAIL_HOST_PASSWORD = 'votre-app-password'  # Mot de passe app específique Google
DEFAULT_FROM_EMAIL = 'noreply@hcp.ma'
```

## 3. Accéder à l'Espace Administrateur

1. Se connecter à la plateforme
2. Clic sur "Espace admin" dans le menu latéral
3. Voir le tableau de bord avec:
   - Bouton "➕ Ajouter un Saisisseur"
   - Bouton "📬 Boîte de Réception"
   - Formulaire d'assignation de thèmes
   - Tableau des saisisseurs

## 4. Cas d'Usage Principaux

### A. Ajouter un Nouveau Saisisseur

```
1. Clic "➕ Ajouter un Saisisseur"
2. Remplir:
   - Nom Complet: "Ahmed Hamidi"
   - Email: "ahmed.hamidi@example.com"
   - Rôle: "Saisisseur"
3. Clic "Ajouter"
4. ✅ Utilisateur créé, email envoyé

Email reçu contient:
- Email/Identifiant: ahmed.hamidi@example.com
- Mot de passe temporaire: (généré automatiquement)
- Rôle: Saisisseur
```

### B. Assigner un Thème à un Saisisseur

```
1. Dans le formulaire d'assignation:
   - Sélectionner un Saisisseur: "Ahmed Hamidi"
   - Sélectionner un Thème: "Éducation"
   - Optionnel - Sous-Thème: "Primaire"
   - Optionnel - Indicateur: "Nombre d'élèves"
2. Clic "Effectuer l'Assignation"
3. ✅ Assignation créée, le saisisseur apparaît dans le tableau

Tableau met à jour:
- Colonne "Thème Assigné" montre "Éducation"
- Statut par défaut: "En cours"
```

### C. Gérer une Demande de Création d'Utilisateur

```
1. Clic "📬 Boîte de Réception"
2. Voir toutes les demandes

Exemple demande:
- Nom: "Fatima El Qadi"
- Email: "fatima.elqadi@example.com"
- Rôle Demandé: "Saisisseur Avancé"
- Statut: "Nouveau"

3. Changer le statut à "Approuvé"
4. ✅ Utilisateur créé automatiquement, email envoyé

Email envoyé:
- Sujet: "Votre demande a été approuvée !"
- Email/Identifiant: fatima.elqadi@example.com
- Mot de passe temporaire: (généré automatiquement)
```

### D. Réinitialiser un Mot de Passe

```
1. Dans la Boîte de Réception
2. Trouver l'utilisateur
3. Clic bouton "🔑 Mot de passe"
4. ✅ Nouveau mot de passe généré et envoyé

Email reçu:
- Sujet: "Votre mot de passe a été réinitialisé"
- Nouveau mot de passe temporaire
```

## 5. Contrôle des Statuts

### Assignations (Tableau des Saisisseurs)
- **En cours** - Travail en cours
- **Complété** - Tâche complétée
- **En attente** - En attente de quelque chose

### Demandes (Boîte de Réception)
- **Nouveau** - Demande nouvellement reçue (🆕)
- **En attente** - Sous révision (⏳)
- **Approuvé** - Approuvée, utilisateur créé (✓)
- **Rejeté** - Refusée (✗)

## 6. Points Importants

### ✅ À Faire
- Configurer l'email correctement
- Créer des administrateurs au moins
- Utiliser des mots de passe forts
- Périodiquement revérifier les assignations

### ❌ À Éviter
- Partager les mots de passe par email non sécurisé
- Créer des doublons d'utilisateurs
- Oublier de mapper les utilisateurs aux thèmes

## 7. Dépannage

### Qu'est-ce qui se passe si...

**Le bouton "Espace admin" ne s'affiche pas?**
- Vérifier que vous êtes connecté
- Vérifier la mise à jour du fichier App.jsx

**L'email n'est pas envoyé?**
- Vérifier EMAIL_BACKEND = 'console' en développement (emails dans terminal)
- Pour la production: Vérifier les credentials SMTP
- Vérifier les logs Django

**L'utilisateur ne peut pas se connecter?**
- Vérifier l'email et le mot de passe (case-sensitive)
- Vérifier que l'utilisateur n'est pas archivé
- Tester avec un nouvel utilisateur

**La migration échoue?**
- Vérifier la syntaxe Python dans models.py
- Vérifier que les ForeignKeys sont correctes
- Exécuter: `python manage.py makemigrations --empty core --name migration_name`

## 8. Exemples React

### Ajouter un Saisisseur - Form Data
```javascript
{
  name: "Mohamed Ali",
  email: "mohamedali@hcp.ma",
  role: "SAISISSEUR"  // ou "AVANCE" ou "ADMIN"
}
```

### Assigner un Thème - Request JSON
```javascript
{
  user: 5,                    // ID de l'utilisateur
  theme: 1,                   // ID du thème
  sous_theme: 3,              // ID du sous-thème (optionnel)
  indicateur: null,           // ID de l'indicateur (optionnel)
  statut: "En cours"
}
```

### Mettre à jour un Statut - Request JSON
```javascript
{
  statut: "Complété"  // ou "En attente"
}
```

## 9. API Endpoints Utiles

### Créer un Saisisseur Directement
```bash
POST /api/user-requests/create_user_with_email/
{
  "name": "Nom Utilisateur",
  "email": "email@example.com",
  "role": "SAISISSEUR"
}
```

### Lister les Saisisseurs
```bash
GET /api/user-theme-assignments/
```

### Lister les Demandes
```bash
GET /api/user-requests/
```

## 10. Support & Aide

- **Documentation complète**: Voir `ADMIN_SPACE_DOCUMENTATION.md`
- **Détails des changements**: Voir `CHANGEMENTS_ADMIN_SPACE.md`
- **Consultez les logs Django**: Terminal Django server
- **Erreurs API**: Vérifier la réponse JSON

---

**Vous êtes prêt! Commencez par appliquer les migrations, puis testez l'espace administrateur.**
