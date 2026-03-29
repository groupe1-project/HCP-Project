# Deployment Secrets Template

Ce document sert de modele pour configurer les secrets GitHub Actions.

## Staging Secrets

Configurer dans GitHub: Settings > Secrets and variables > Actions

- `STAGING_HOST`: Nom DNS ou IP du serveur staging
- `STAGING_USER`: Utilisateur SSH pour staging
- `STAGING_SSH_KEY`: Cle privee SSH (format OpenSSH)
- `STAGING_PATH`: Chemin absolu du dossier de deploiement staging
- `STAGING_NOTIFY_WEBHOOK` (optionnel): URL webhook notifications deploy

## Production Secrets

Configurer dans GitHub: Settings > Secrets and variables > Actions

- `PROD_HOST`: Nom DNS ou IP du serveur production
- `PROD_USER`: Utilisateur SSH pour production
- `PROD_SSH_KEY`: Cle privee SSH (format OpenSSH)
- `PROD_PATH`: Chemin absolu du dossier de deploiement production
- `PROD_HEALTH_URL`: URL complete du endpoint health (ex: https://app.example.com/health/)
- `PROD_RESTART_COMMAND`: Commande restart service (ex: systemctl restart hcp-backend)
- `PROD_NOTIFY_WEBHOOK` (optionnel): URL webhook notifications deploy

## Optional Production Auth Smoke Test

Activer uniquement avec un compte de service dedie:

- `PROD_AUTH_LOGIN_URL`: URL login API (ex: https://app.example.com/api/auth/login/)
- `PROD_AUTH_ME_URL`: URL me API (ex: https://app.example.com/api/auth/me/)
- `PROD_SMOKE_EMAIL`: Email compte de service smoke test
- `PROD_SMOKE_PASSWORD`: Mot de passe compte de service smoke test

## Security Notes

- Ne jamais versionner les vraies valeurs dans le repository.
- Utiliser un compte de service dedie pour les smoke tests auth.
- Limiter les droits SSH de l'utilisateur deploy (principe du moindre privilege).
- Rotation des secrets recommandee tous les 90 jours.
