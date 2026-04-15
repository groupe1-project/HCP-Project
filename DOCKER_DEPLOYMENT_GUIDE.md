# Docker Deployment Guide (Evaluation Version)

Ce guide permet de lancer toute l'application avec Docker pour une evaluation rapide.

## 1. Prerequis

- Docker Desktop installe et demarre
- Port `8080` libre

## 2. Lancer l'application

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

## 5. Voir les logs (debug)

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## 6. Arreter

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
