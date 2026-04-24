# Guide Deploiement Reseau Local (Interne)

Date: 2026-04-19

Objectif:
- Admin et Saisisseur accessibles uniquement sur le reseau interne de l'entreprise.
- Une seule base de donnees partagee pour tous les utilisateurs internes.
- Aucun acces direct des PC clients a la base PostgreSQL.

## 1. Principe simple

Architecture:
- PC utilisateurs internes -> Navigateur -> Application sur PC serveur -> Base PostgreSQL (interne)

Important:
- Les utilisateurs ne se connectent jamais directement a la base.
- Ils ouvrent seulement l'application dans le navigateur.
- La base est centralisee sur le PC serveur.

## 2. Couts

Cette solution est gratuite en logiciel:
- Docker: gratuit
- PostgreSQL: gratuit
- Django/Nginx/React: gratuits

Couts possibles:
- Un PC serveur allume pendant les heures de travail
- Electricite et reseau interne

## 3. Prerequis pour demain (PC serveur)

1) Installer Docker Desktop
2) Verifier que Docker est demarre
3) Mettre ce projet sur le PC serveur
4) Donner une IP locale fixe au PC serveur (exemple: 192.168.1.20)
5) Ouvrir les ports 8080 et 8443 dans le pare-feu Windows (reseau prive)

Commande PowerShell admin (pare-feu):
New-NetFirewallRule -DisplayName HCP-Frontend-8080 -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
New-NetFirewallRule -DisplayName HCP-Frontend-8443 -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow -Profile Private

## 4. Preparation du fichier d'environnement

1) Copier le fichier .env.production.example vers .env.local
2) Editer .env.local avec les vraies valeurs

Variables minimales a definir:
- DJANGO_SECRET_KEY: secret long et unique
- DJANGO_ALLOWED_HOSTS: 192.168.1.20,localhost,127.0.0.1
- DJANGO_CORS_ALLOWED_ORIGINS: https://192.168.1.20:8443
- DJANGO_CSRF_TRUSTED_ORIGINS: https://192.168.1.20:8443
- POSTGRES_DB: hcp_prod
- POSTGRES_USER: hcp_prod_user
- POSTGRES_PASSWORD: mot de passe fort
- FRONTEND_BIND_ADDRESS: 0.0.0.0
- FRONTEND_PORT: 8080
- FRONTEND_HTTPS_BIND_ADDRESS: 0.0.0.0
- FRONTEND_HTTPS_PORT: 8443
- AI_FEATURES_ENABLED: true (si vous voulez l'assistant IA)
- OLLAMA_ENABLED: true
- OLLAMA_BASE_URL: http://ollama:11434
- OLLAMA_MODEL: qwen2.5:7b-instruct
- ASSISTANT_PREFER_OLLAMA: true
- ASSISTANT_ALLOW_GEMINI_FALLBACK: false
- ASSISTANT_OLLAMA_MODEL: qwen2.5:7b-instruct

## 5. Lancement de l'application (serveur)

Generer le certificat TLS local (obligatoire):

powershell -ExecutionPolicy Bypass -File .\scripts\generate_local_tls_cert.ps1 -IpAddress 192.168.1.20

Depuis la racine du projet:

docker compose --env-file .env.local -f docker-compose.prod.yml -f docker-compose.prod.https.yml up --build -d

Verifier les services:

docker compose --env-file .env.local -f docker-compose.prod.yml -f docker-compose.prod.https.yml ps

Puis telecharger le modele Ollama (obligatoire pour l'assistant):

docker compose --env-file .env.local -f docker-compose.prod.yml -f docker-compose.prod.https.yml exec -T ollama ollama pull qwen2.5:7b-instruct

## 6. Creation des comptes internes (premiere fois)

Option A: utiliser les comptes demo deja prevus via scripts d'evaluation.
Option B: creer vos comptes entreprise via l'interface admin.

Pour un lancement demo rapide, vous pouvez executer:

powershell -ExecutionPolicy Bypass -File .\scripts\eval_reseed_users.ps1

Puis changer les mots de passe depuis l'application.

## 7. Test depuis un autre PC interne

Sur un 2e PC du meme reseau:
- Ouvrir: https://192.168.1.20:8443
- Installer le certificat docker/nginx/certs/local.crt dans Trusted Root du PC client pour eviter l'alerte navigateur
- Tester:
  - Espace Admin
  - Espace Saisisseur

Verifier partage de la meme base:
1) Creer ou modifier une donnee depuis PC A
2) Rafraichir depuis PC B
3) La modification doit etre visible

Verifier aussi les fonctions avancees:
1) Email reset mot de passe: lancer une demande et verifier reception email
2) Assistant admin: poser une question depuis l'espace admin
3) Si l'assistant ne repond pas: verifier que le modele Ollama est bien telecharge

## 8. Arret / redemarrage

Arret:

docker compose --env-file .env.local -f docker-compose.prod.yml -f docker-compose.prod.https.yml down

Redemarrage:

docker compose --env-file .env.local -f docker-compose.prod.yml -f docker-compose.prod.https.yml up -d

## 9. Sauvegarde de la base (recommande)

Plan simple:
- Sauvegarde quotidienne du volume postgres
- Conserver au moins 7 jours

Si besoin, utiliser les scripts:
- scripts/postgres_backup.ps1
- scripts/postgres_restore.ps1

## 10. Cas visiteur public (plus tard)

Pour votre besoin final:
- Admin/Saisisseur restent internes (URL intranet)
- Visiteur peut etre publie separement
- Le site existant ajoute simplement un lien vers l'espace visiteur

## 11. Depannage rapide

Probleme: les autres PC ne voient pas l'application
- Verifier IP serveur
- Verifier pare-feu ports 8080 et 8443
- Verifier FRONTEND_BIND_ADDRESS=0.0.0.0
- Verifier FRONTEND_HTTPS_BIND_ADDRESS=0.0.0.0
- Verifier que les PC sont sur le meme reseau

Probleme: erreur connexion API/login
- Verifier DJANGO_ALLOWED_HOSTS
- Verifier DJANGO_CORS_ALLOWED_ORIGINS
- Verifier DJANGO_CSRF_TRUSTED_ORIGINS
- Verifier que l'URL utilisee est bien https://192.168.1.20:8443

Probleme: conteneur backend down
- Voir logs:
  docker compose --env-file .env.local -f docker-compose.prod.yml -f docker-compose.prod.https.yml logs -f backend

Probleme: assistant IA indisponible
- Verifier service ollama:
  docker compose --env-file .env.local -f docker-compose.prod.yml -f docker-compose.prod.https.yml ps
- Verifier modele present:
  docker compose --env-file .env.local -f docker-compose.prod.yml -f docker-compose.prod.https.yml exec -T ollama ollama list
- Telecharger modele si absent:
  docker compose --env-file .env.local -f docker-compose.prod.yml -f docker-compose.prod.https.yml exec -T ollama ollama pull qwen2.5:7b-instruct

---

Conclusion:
Cette methode permet un vrai usage interne multi-PC, gratuit en logiciel, avec une base partagee et centralisee sur un seul PC serveur.
