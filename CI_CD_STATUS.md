# CI/CD Status and Production Readiness

Ce document resume ce qui est implemente pour CI/CD et ce qui reste a configurer.

## CI implemente

Workflow: `.github/workflows/ci.yml`

Le pipeline CI execute automatiquement sur `push` (main/master/develop) et `pull_request`.

### Backend job

- Provisionne PostgreSQL 16 en service GitHub Actions.
- Installe les dependances backend depuis `requirements.txt`.
- Execute:
  - `python manage.py check`
  - `python manage.py test core.tests -v 2`
  - `python scripts/security_preflight.py`

### Frontend job

- Installe les dependances frontend depuis `frontend/package-lock.json`.
- Execute:
  - `npm run lint`
  - `npm run build`

## CD implemente (staging)

Workflow: `.github/workflows/deploy-staging.yml`

- Declenchement manuel (`workflow_dispatch`).
- Verification stricte des secrets requis.
- Sync du code vers serveur staging via SSH/rsync.
- Execution distante des commandes de deploiement:
  - installation dependances backend
  - migrations Django
  - build frontend
  - verification Django
- Notifications de succes/echec vers webhook (optionnel).

### Secrets requis

Configurer dans GitHub repository settings > Secrets and variables > Actions:

- `STAGING_HOST`
- `STAGING_USER`
- `STAGING_SSH_KEY`
- `STAGING_PATH`
- `STAGING_NOTIFY_WEBHOOK` (optionnel)

## Delivery test (sans serveur)

Workflow: `.github/workflows/delivery-only.yml`

- Declenchement manuel (`workflow_dispatch`).
- Build backend/frontend sans connexion a un serveur cible.
- Generation d'un package livrable `.tgz`.
- Generation d'un checksum `.sha256`.
- Publication de l'artifact dans GitHub Actions.

Utilisation: permet de valider la phase CD "delivery" avant toute phase deploy.

## CD implemente (production)

Workflow: `.github/workflows/deploy-production.yml`

- Declenchement manuel (`workflow_dispatch`) sur environnement `production`.
- Verification stricte des secrets requis.
- Backup automatique de l'etat courant avant deploiement.
- Sync du code vers serveur production via SSH/rsync.
- Execution distante des commandes de deploiement (install, migrate, build, check, restart).
- Smoke test post-deploiement sur endpoint health.
- Smoke test auth optionnel (login + me) si secrets fournis.
- Rollback automatique sur echec (restauration backup + restart).
- Retention automatique des backups deploiement (10 derniers).

### Secrets requis (production)

- `PROD_HOST`
- `PROD_USER`
- `PROD_SSH_KEY`
- `PROD_PATH`
- `PROD_HEALTH_URL`
- `PROD_RESTART_COMMAND`
- `PROD_NOTIFY_WEBHOOK` (optionnel)
- `PROD_AUTH_LOGIN_URL` (optionnel pour smoke auth)
- `PROD_AUTH_ME_URL` (optionnel pour smoke auth)
- `PROD_SMOKE_EMAIL` (optionnel pour smoke auth)
- `PROD_SMOKE_PASSWORD` (optionnel pour smoke auth)

## Ce qui reste pour un CD production complet

- Connecter les webhooks de notification (staging/prod) aux canaux reels d'exploitation.
- Configurer un compte de service dedie pour activer le smoke auth en production.
- Ajouter une verification fonctionnelle metier (au-dela de health/auth) apres deploiement.

## Conclusion

- CI: en place.
- Delivery sans serveur: en place.
- CD staging: en place (manuel et securise).
- CD production: en place avec rollback et smoke health.

## Documents operationnels ajoutes

- Template secrets: `DEPLOYMENT_SECRETS_TEMPLATE.md`
- Procedure go-live: `GO_LIVE_PROCEDURE.md`
- Script verification health: `scripts/verify_health.ps1`
