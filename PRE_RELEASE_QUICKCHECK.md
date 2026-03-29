# Pre-Release Quick Check

Utilise ce script avant chaque livraison ou push vers la branche principale.

## Commande principale (Windows PowerShell)

Depuis la racine du projet:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pre_release_check.ps1
```

## Options utiles

- Ignorer backend:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pre_release_check.ps1 -SkipBackend
```

- Ignorer frontend:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pre_release_check.ps1 -SkipFrontend
```

- Ignorer security preflight (si environnement local incomplet):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pre_release_check.ps1 -SkipSecurityPreflight
```

## Ce qui est verifie

- Backend: `manage.py check`
- Backend: `manage.py test core.tests -v 2`
- Backend: `scripts/security_preflight.py` (optionnel)
- Frontend: `npm run lint`
- Frontend: `npm run build`

## Recommandation de release

Lancer ce script puis:

1. Commit
2. Push
3. Verifier workflow CI GitHub Actions
4. Lancer workflow Delivery/Deploy
