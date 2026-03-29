param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [string]$TargetDatabase,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Command not found: $Name. Install PostgreSQL client tools and add them to PATH."
    }
}

Require-Command "pg_restore"
Require-Command "psql"

if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}

$dbName = if ($TargetDatabase) { $TargetDatabase } elseif ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "hcp_db" }
$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }
$dbHost = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "localhost" }
$dbPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
$dbPassword = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "" }

if ($dbPassword) {
    $env:PGPASSWORD = $dbPassword
}

$connectionString = "host=$dbHost port=$dbPort user=$dbUser dbname=$dbName"

Write-Host "Backup source: $BackupFile"
Write-Host "Restore target: $connectionString"

if ($DryRun) {
    Write-Host "Dry run mode: listing archive content only."
    & pg_restore --list "$BackupFile"
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore --list failed with exit code $LASTEXITCODE"
    }
    exit 0
}

Write-Host "Restoring backup into target database..."
& pg_restore --clean --if-exists --no-owner --no-privileges --verbose --dbname "$connectionString" "$BackupFile"
if ($LASTEXITCODE -ne 0) {
    throw "pg_restore failed with exit code $LASTEXITCODE"
}

Write-Host "Running post-restore sanity query (django_migrations count)..."
& psql --host "$dbHost" --port "$dbPort" --username "$dbUser" --dbname "$dbName" --command "SELECT COUNT(*) AS migration_count FROM django_migrations;"
if ($LASTEXITCODE -ne 0) {
    throw "Post-restore verification query failed with exit code $LASTEXITCODE"
}

Write-Host "Restore completed successfully."
