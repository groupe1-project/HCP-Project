# Rapport Technique Projet HCP

## 1. Contexte et problématique
Le projet HCP vise à centraliser, fiabiliser et publier des données statistiques régionales (Béni Mellal-Khénifra) dans une plateforme unique.

Avant la mise en place de cette solution, les données étaient dispersées, hétérogènes dans leur structure (fichiers Excel non normalisés), et difficiles à exploiter rapidement pour :
- la gouvernance interne (administrateurs),
- la production/édition (saisisseurs),
- la consultation (visiteurs).

Le besoin principal est donc double :
- unifier la gestion du cycle de vie de la donnée (création, affectation, import, contrôle, publication),
- proposer une visualisation claire et configurable selon les profils métiers.

---

## 2. Objectifs du projet
### Objectif général
Concevoir une plateforme web de gestion statistique orientée rôles, capable d'importer des tableaux hétérogènes, de les normaliser, puis de les exposer dans des vues tableau/graphique.

### Objectifs spécifiques
- Gérer les entités métier : thèmes, catégories, sous-thèmes, indicateurs, données.
- Gérer les utilisateurs et rôles : ADMIN, SAISISSEUR, AVANCE.
- Mettre en place un flux d'assignation des tâches (thèmes/sous-thèmes).
- Intégrer un import Excel standard et un import intelligent (normalisation + mapping IA).
- Configurer la publication publique/privée et l'archivage.
- Permettre la configuration visiteur (colonnes visibles, filtres, vue par défaut, pivot).
- Fournir des exports (XLSX, CSV, TXT) et des graphes configurables.

---

## 3. Choix d'architecture
## 3.1 Typologie
L'architecture implémentée est une architecture **monolithe modulaire avec API REST + SPA frontend**.

Elle n'est pas microservices pour les raisons suivantes :
- backend unique Django,
- base de données logique centralisée,
- absence de déploiements indépendants par domaine.

## 3.2 Justification du choix
Ce choix est adapté au stade actuel (MVP avancé / pré-production) car il favorise :
- la cohérence transactionnelle des données,
- la rapidité de développement,
- la simplicité d'exploitation,
- la réduction de complexité DevOps.

---

## 4. Architecture logique
```text
[Frontend React SPA]
   |
   | HTTP/JSON (Axios)
   v
[API Django REST Framework]
   |
   +-- Auth & Rôles
   +-- Gestion Thèmes/Catégories/Sous-thèmes
   +-- Import Excel (standard + intelligent)
   +-- Gestion Graphes & Config visiteur
   +-- Gestion Affectations & Demandes utilisateurs
   +-- Endpoints publics de consultation
   |
   v
[Base de données PostgreSQL]
```

## 4.1 Couche présentation
- React 19 + Vite.
- Interface role-aware (admin/saisisseur/visiteur).
- Gestion d'état local (filtres, tableaux, graphes, modales, configuration).

## 4.2 Couche services/API
- Django + DRF.
- ViewSets REST + actions métier.
- Contrôle d'accès via token + permissions.

## 4.3 Couche données
- Modèles relationnels structurés autour du référentiel statistique.
- JSONField pour stocker les tableaux importés et configurations flexibles.

---

## 5. Architecture physique (déploiement cible)
```text
[Client navigateur]
   -> [Serveur Frontend (Vite build servi en statique)]
   -> [Serveur Django API]
   -> [PostgreSQL]
```

En environnement local de développement :
- Frontend : http://localhost:5173
- Backend : http://127.0.0.1:8000

---

## 6. Modèle métier principal
Entités clés :
- CustomUser (rôle, statut),
- Theme,
- Categorie,
- SousTheme,
- Indicateur,
- Donnee,
- UserThemeAssignment,
- UserRequest,
- InfoBanner.

Caractéristiques importantes :
- SousTheme concentre la donnée tabulaire (data_json), l'ordre des colonnes (columns_order), les graphes (charts_config), et la configuration visiteur.
- Les statuts de visibilité/publication et d'archivage pilotent l'exposition publique.

---

## 7. Flux fonctionnels majeurs
## 7.1 Flux admin
- Créer/modifier thèmes, catégories, sous-thèmes.
- Importer des tableaux.
- Configurer graphes et paramètres visiteur.
- Gérer utilisateurs, demandes, assignations.
- Publier/masquer/archiver.

## 7.2 Flux saisisseur
- Accéder aux sous-thèmes assignés.
- Travailler en brouillon.
- Soumettre pour validation.

## 7.3 Flux visiteur
- Consulter uniquement les contenus publics non archivés.
- Appliquer filtres autorisés.
- Utiliser vues tabulaires et graphiques configurées.

---

## 8. Pipeline import intelligent (point technique central)
Le pipeline de l'import intelligent applique successivement :
1. Lecture Excel et détection de qualité d'entêtes.
2. Si nécessaire, normalisation table croisée -> table plate.
3. Adoption de schéma entrant en mode free_schema.
4. Mapping IA vers schéma cible si requis.
5. Fallback heuristique déterministe si IA indisponible.
6. Persistance data_json + columns_order.

Améliorations apportées récemment :
- correction de compatibilité pandas,
- meilleure détection des structures d'entête,
- inférence dynamique des noms de dimensions,
- réduction du risque de réutilisation d'un ancien schéma pollué.

---

## 9. Sécurité, contrôle d'accès et gouvernance
Mécanismes en place :
- authentification token DRF,
- permissions par endpoint,
- séparation API publique / API privée,
- contrôle des actions sensibles côté rôle.

Points à renforcer avant production :
- externalisation des secrets (clés/API, SECRET_KEY, DB credentials),
- durcissement CORS/ALLOWED_HOSTS,
- homogénéisation des règles RBAC,
- audit trail des opérations critiques.

---

## 10. Qualité logicielle et limites actuelles
Forces :
- couverture fonctionnelle métier élevée,
- backend cohérent et extensible,
- pipeline data pragmatique et robuste,
- configuration visiteur fine.

Limites :
- composant frontend principal volumineux,
- tests automatisés encore faibles,
- industrialisation CI/CD partielle,
- configuration encore orientée développement.

---

## 11. Analyse de risques
Risques techniques :
- dette de modularisation frontend,
- dépendance à la qualité des fichiers source,
- exposition de secrets si non corrigée.

Risques opérationnels :
- erreurs de publication si gouvernance non strictement appliquée,
- variabilité des formats Excel entrants.

Mesures de réduction :
- ajout de validations automatiques,
- tests de non-régression import,
- checklist de mise en production,
- monitoring des erreurs API.

---

## 12. Feuille de route recommandée
### Lot 1 (priorité haute)
- sécurisation des secrets et configuration production,
- tests backend critiques (auth, import, publication),
- refactor API client frontend.

### Lot 2
- découpage du composant App en modules métier,
- amélioration UX de gestion massive (bulk actions),
- journalisation métier avancée.

### Lot 3
- documentation OpenAPI,
- observabilité complète (logs structurés, alertes),
- optimisation performance des gros tableaux.

---

## 13. Conclusion
Le projet HCP atteint un niveau de maturité solide pour un usage opérationnel contrôlé :
- architecture adaptée au contexte (monolithe modulaire),
- fonctionnalités métier complètes sur la chaîne de valeur de la donnée,
- import intelligent désormais stabilisé et plus fiable,
- base saine pour une transition vers une pré-production durable.

La prochaine étape n'est pas une refonte d'architecture, mais un **durcissement progressif** (sécurité, tests, modularisation) afin d'atteindre les standards de production institutionnelle.

---

# Annexe - Version courte pour email
Bonjour,

Le projet HCP est implémenté en architecture monolithe modulaire (Django/DRF) avec frontend React (SPA). Il couvre la gestion complète des thèmes/sous-thèmes, des utilisateurs et affectations, de la publication publique, ainsi que l'import intelligent de fichiers Excel.

L'import intelligent a été renforcé : normalisation des tables croisées, adoption contrôlée du schéma entrant (free_schema), mapping IA et fallback heuristique en cas d'indisponibilité IA.

Le système est opérationnel sur les parcours métier clés. Les chantiers restants avant production concernent surtout la sécurisation des secrets/configuration, l'augmentation de la couverture de tests et la modularisation frontend.

Cordialement.
