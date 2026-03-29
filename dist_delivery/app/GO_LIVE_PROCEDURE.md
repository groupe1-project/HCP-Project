# Go-Live Procedure

Procedure recommandee pour un deploiement production controle.

## 1) Pre-Go-Live Checks

- Verifier que CI passe sur la branche cible.
- Verifier que les migrations sont stables en staging.
- Verifier que le runbook backup/restore a ete teste.
- Verifier que tous les secrets GitHub Actions sont configures.

## 2) Staging Deployment

1. Lancer workflow staging: `.github/workflows/deploy-staging.yml`.
2. Verifier endpoint staging health.
3. Verifier login/logout et parcours admin critique.
4. Verifier logs applicatifs et erreurs.

## 3) Production Deployment

1. Lancer workflow production: `.github/workflows/deploy-production.yml`.
2. Verifier que backup pre-deploy est cree.
3. Verifier smoke health (`ready=true`).
4. Si configure, verifier smoke auth.
5. Verifier notification succes sur canal ops.

## 4) Post-Deploy Validation

- Verifier tableau de bord monitoring (latence, erreurs 5xx, uptime).
- Verifier endpoints critiques metier.
- Verifier logs security/audit sans anomalies.

## 5) Rollback Decision Rules

Rollback immediat si l'un des points suivants est vrai:

- Health endpoint non pret (`ready=false`).
- Taux d'erreurs critiques anormal apres deploy.
- Login ou actions admin critiques indisponibles.

Le workflow production tente deja un rollback automatique en cas d'echec.

## 6) Formal Closure

- Documenter l'heure de deploy, commit, resultat smoke tests.
- Documenter incidents eventuels et actions correctives.
- Mettre a jour la checklist production.
