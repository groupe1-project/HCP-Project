Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Arret des conteneurs..." -ForegroundColor Cyan
docker compose down

Write-Host "Arret termine." -ForegroundColor Green
Write-Host "Pour tout reinitialiser (y compris base Postgres), executez:" -ForegroundColor Yellow
Write-Host "docker compose down -v"
