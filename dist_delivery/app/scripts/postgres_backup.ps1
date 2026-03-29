param(
    [string]$BackupDir = "backups",
    [switch]$IncludeGlobals
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Command not found: $Name. Install PostgreSQL client tools and add them to PATH."
    }
}

Require-Command "pg_dump"
if ($IncludeGlobals) {
    Require-Command "pg_dumpall"
}

$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "hcp_db" }
$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }
$dbHost = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "localhost" }
$dbPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
$dbPassword = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "" }

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "$dbName`_$timestamp.dump"

if ($dbPassword) {
    $env:PGPASSWORD = $dbPassword
}

$connectionString = "host=$dbHost port=$dbPort user=$dbUser dbname=$dbName"
Write-Host "Creating PostgreSQL backup: $backupFile"
& pg_dump --format=custom --verbose --file "$backupFile" --dbname "$connectionString"
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE"
}

if ($IncludeGlobals) {
    $globalsFile = Join-Path $BackupDir "globals_$timestamp.sql"
    Write-Host "Exporting global roles and grants: $globalsFile"
    & pg_dumpall --globals-only --file "$globalsFile" --host "$dbHost" --port "$dbPort" --username "$dbUser"
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dumpall failed with exit code $LASTEXITCODE"
    }
}

Write-Host "Backup completed successfully."
Write-Host "Backup file: $backupFile"
