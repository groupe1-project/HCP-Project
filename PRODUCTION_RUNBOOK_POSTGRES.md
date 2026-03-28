# Runbook PostgreSQL: Backup and Restore

Ce runbook couvre la sauvegarde et la restauration PostgreSQL pour l'application HCP.

## 1) Preconditions

- Variables d'environnement configurees (`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`).
- Outils client PostgreSQL installes et disponibles dans `PATH`:
  - `pg_dump`
  - `pg_restore`
  - `psql`
- Fenetre de maintenance planifiee pour toute restauration.

## 2) Backup Procedure (Windows PowerShell)

Depuis la racine du projet:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\postgres_backup.ps1 -BackupDir .\backups -IncludeGlobals
```

Resultat attendu:
- Un fichier `.dump` dans `backups/`.
- Optionnellement un fichier `globals_*.sql` (roles/grants).

## 3) Backup Validation

Verifier rapidement l'archive:

```powershell
pg_restore --list .\backups\hcp_db_YYYYMMDD_HHMMSS.dump
```

Verifier l'integrite du fichier:

```powershell
Get-FileHash .\backups\hcp_db_YYYYMMDD_HHMMSS.dump -Algorithm SHA256
```

Conserver le hash dans le registre d'operations.

## 4) Restore Procedure (Staging First)

Test de restauration sans ecriture:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\postgres_restore.ps1 -BackupFile .\backups\hcp_db_YYYYMMDD_HHMMSS.dump -TargetDatabase hcp_restore_test -DryRun
```

Restauration reelle:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\postgres_restore.ps1 -BackupFile .\backups\hcp_db_YYYYMMDD_HHMMSS.dump -TargetDatabase hcp_restore_test
```

## 5) Post-Restore Checks

Apres restauration:

```powershell
python manage.py migrate --check
python manage.py check
python manage.py test core.tests -v 2
```

Critere de succes:
- `migrate --check` ne propose aucune migration en attente.
- `check` ne retourne pas d'erreur bloquante.
- Tests backend critiques passent.

## 6) Production Recovery Checklist

- [ ] Dernier backup date de moins de 24h.
- [ ] Hash SHA256 archive enregistre.
- [ ] Dry run restore valide sur staging.
- [ ] Test d'auth (`/api/auth/login` + `/api/auth/me`) valide.
- [ ] Health endpoint (`/health/`) retourne `ready=true`.
- [ ] Journal de l'incident et RTO/RPO documentes.

## 7) Safety Notes

- Ne jamais restaurer directement en production sans test sur staging.
- Toujours prendre un nouveau backup juste avant une restauration.
- Le flag `--clean` supprime les objets cibles avant recreation: utiliser uniquement sur base cible approuvee.
