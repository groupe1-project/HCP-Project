# Documentation - Espace Administrateur

## Vue d'ensemble
L'espace administrateur permet de gérer les utilisateurs (saisisseurs) et d'assigner les thèmes aux utilisateurs. Ce module comprend :

1. **Gestion des Saisisseurs** - Créer et gérer les utilisateurs
2. **Assignation de Thèmes** - Assigner thèmes, sous-thèmes et indicateurs aux saisisseurs
3. **Boîte de Réception** - Gérer les demandes de création d'utilisateurs

## Fonctionnalités Principales

### 1. Ajouter un Saisisseur
- **Button**: "➕ Ajouter un Saisisseur"
- **Popup**: Formulaire avec les champs:
  - Nom Complet
  - Email
  - Rôle (Saisisseur / Saisisseur Avancé / Administrateur)
- **Action**: 
  - Un utilisateur est créé automatiquement
  - Un mot de passe temporaire est généré
  - Un email avec les identifiants est envoyé à l'utilisateur

### 2. Assignation de Thèmes
- **Localisation**: Formulaire au-dessus du tableau des saisisseurs
- **Champs**:
  - Sélectionner un Saisisseur (requis)
  - Sélectionner un Thème (requis)
  - Sélectionner un Sous-Thème (optionnel)
  - Sélectionner un Indicateur (optionnel)
- **Action**: Assigne le thème au saisisseur avec statut "En cours"

### 3. Tableau des Saisisseurs
- **Colonnes**:
  - Nom
  - Email
  - Rôle (badge avec couleur)
  - Thème Assigné
  - Statut (dropdown pour changer: En cours / Complété / En attente)
- **Fonctionnalités**:
  - Voir tous les saisisseurs assignés
  - Changer le statut d'assignation
  - Mise à jour en temps réel

### 4. Boîte de Réception
- **Button**: "📬 Boîte de Réception"
- **Popup**: Tableau des demandes d'utilisateurs avec:
  - Nom
  - Email
  - Rôle Demandé
  - Statut (dropdown: Nouveau / En attente / Approuvé / Rejeté)
  - Demande (texte)
  - Actions (Réinitialiser mot de passe)
- **Fonctionnalités**:
  - Voir toutes les demandes
  - Changer le statut d'une demande
  - Approuver une demande (crée automatiquement l'utilisateur et envoie un email)
  - Réinitialiser le mot de passe (génère un nouveau mot de passe et envoie un email)

## Modèles de Données

### CustomUser (existant)
- Rôles: ADMIN, SAISISSEUR, AVANCE
- Email et authentification

### UserThemeAssignment (nouveau)
- Lie un utilisateur à un thème/sous-thème/indicateur
- Statut: En cours / Complété / En attente
- Unique ensemble (user, theme, sous_theme, indicateur)

### UserRequest (nouveau)
- Demande de création d'utilisateur
- Statut: Nouveau / En attente / Approuvé / Rejeté
- Contient les informations de la demande

## Endpoints API

### UserThemeAssignment
- `GET /api/user-theme-assignments/` - Lister tous les assignements
- `POST /api/user-theme-assignments/` - Créer un assignement
- `PATCH /api/user-theme-assignments/{id}/update_statut/` - Mettre à jour le statut

### UserRequest
- `GET /api/user-requests/` - Lister toutes les demandes
- `POST /api/user-requests/create_user_with_email/` - Créer un utilisateur avec email
- `POST /api/user-requests/create_request/` - Créer une demande
- `PATCH /api/user-requests/{id}/update_statut/` - Mettre à jour le statut
- `POST /api/user-requests/{id}/reset_password/` - Réinitialiser le mot de passe

## Configuration Email

La configuration email se trouve dans `backend/settings.py`:

```python
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'  # Développement
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'votre-email@gmail.com'  # À configurer
EMAIL_HOST_PASSWORD = 'votre-app-password'  # À configurer
```

### Changer pour Production
1. Utilisez un service SMTP réel (Gmail, SendGrid, etc.)
2. Configurez `EMAIL_HOST_USER` et `EMAIL_HOST_PASSWORD`
3. Changez `EMAIL_BACKEND` à `'django.core.mail.backends.smtp.EmailBackend'`

## Génération de Mots de Passe

Les mots de passe sont générés automatiquement avec 8 caractères incluant :
- Lettres majuscules et minuscules
- Chiffres
- Caractères spéciaux (!@#$%^&*)

Exemple: `aB3$xY9!`

## Permissions et Accès

- La page administrative est accessible via le menu latéral "Espace admin"
- À l'avenir, on peut ajouter une vérification : seuls les administrateurs (rôle ADMIN) peuvent y accéder
- Actuellement, tout utilisateur authentifié peut y accéder (à modifier selon besoin)

## Flux d'Utilisation Typique

### Créer un nouveau saisisseur:
1. Clic sur "➕ Ajouter un Saisisseur"
2. Remplir: Nom, Email, Rôle
3. Clic "Ajouter"
4. Email envoyé automatiquement avec mot de passe

### Assigner un thème:
1. Sélectionner le saisisseur dans le formulaire d'assignation
2. Sélectionner le thème
3. Optionnel: Sélectionner sous-thème et indicateur
4. Clic "Effectuer l'Assignation"

### Gérer les demandes:
1. Clic sur "📬 Boîte de Réception"
2. Voir toutes les demandes en attente
3. Changer le statut à "Approuvé"
4. Utilisateur créé automatiquement et email envoyé

## Prochaines Améliorations

1. Restriction d'accès - Seuls les ADMIN peuvent accéder
2. Filtres dans le tableau des saisisseurs
3. Bulk assign multiple saisisseurs
4. Historique des assignations
5. Révoquer une assignation
6. Ajouter des permissions plus granulaires par thème
