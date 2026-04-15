# Docker Deployment Guide (Evaluation Version)

Ce guide permet de lancer toute l'application avec Docker pour une evaluation rapide.

## 1. Prerequis

- Docker Desktop installe et demarre
- Port `8080` libre

## 2. Lancer l'application

### Option recommandee (encadrant, 1 commande)

Depuis la racine du projet:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\eval_start.ps1
```

Ce script:
- build + demarre Docker Compose
- cree/actualise les comptes de demonstration
- affiche les URLs et identifiants de test

### Option manuelle

Depuis la racine du projet:

```bash
docker compose up --build -d
```

## 3. Verifier les services

```bash
docker compose ps
```

Tu dois voir:
- `hcp_db` (PostgreSQL)
- `hcp_backend` (Django + API)
- `hcp_frontend` (Nginx + React build)

## 4. Acces application

- Frontend: `http://localhost:8080`
- Health API: `http://localhost:8080/health/`

Comptes de demonstration (si `eval_start.ps1` utilise):
- ADMIN: `admin@demo.local` / `Admin123!Demo`
- SAISISSEUR: `saisisseur@demo.local` / `Saisi123!Demo`

Pages:
- Visiteur: `http://localhost:8080/`
- Admin: `http://localhost:8080/admin/login`
- Saisisseur: `http://localhost:8080/saisisseur/login`

## 5. Voir les logs (debug)

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Verification fonctionnelle rapide:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\eval_verify.ps1
```

## 6. Arreter

Option recommandee:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\eval_stop.ps1
```

Option manuelle:

```bash
docker compose down
```

Pour supprimer aussi les donnees Postgres:

```bash
docker compose down -v
```

## 7. Partager avec l'encadrant

Option A (simple):
- Tu envoies le code complet avec ce guide
- L'encadrant execute `docker compose up --build -d`

Option B (image prebuild):
- Tu pushes des images Docker sur Docker Hub/GHCR
- L'encadrant lance avec un compose adapte (sans build local)

## 8. Notes importantes

- Cette version est orientee evaluation locale.
- Le backend tourne avec `DJANGO_DEBUG=true` dans `docker-compose.yml`.
- Pour un vrai deploiement production internet, il faudra:
  - HTTPS/TLS
  - secrets forts
  - `DJANGO_DEBUG=false`
  - politique CSP stricte
  - gestion de sauvegarde DB
