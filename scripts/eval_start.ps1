Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "[1/5] Verification Docker CLI..." -ForegroundColor Cyan
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI introuvable. Installez Docker Desktop puis reessayez."
}

Write-Host "[2/5] Verification Docker Engine..." -ForegroundColor Cyan
docker info *> $null

Write-Host "[3/5] Build + demarrage stack..." -ForegroundColor Cyan
docker compose up --build -d

Write-Host "[4/5] Provision comptes de demonstration..." -ForegroundColor Cyan
$seedCode = @"
from core.models import CustomUser

def upsert_user(username, email, role, password, is_staff=False, is_superuser=False):
    u, _ = CustomUser.objects.get_or_create(username=username)
    u.email = email
    u.role = role
    u.is_staff = is_staff
    u.is_superuser = is_superuser
    u.is_active = True
    u.set_password(password)
    u.save()

upsert_user('admin_demo', 'admin@demo.local', 'ADMIN', 'Admin123!Demo', is_staff=True, is_superuser=True)
upsert_user('saisisseur_demo', 'saisisseur@demo.local', 'SAISISSEUR', 'Saisi123!Demo', is_staff=False, is_superuser=False)
print('demo users ready')
"@

docker compose exec -T backend python manage.py shell -c $seedCode

Write-Host "[5/5] Etat des conteneurs" -ForegroundColor Cyan
docker compose ps

Write-Host "" 
Write-Host "Application prete pour evaluation:" -ForegroundColor Green
Write-Host "- Visiteur   : http://localhost:8080/"
Write-Host "- Admin      : http://localhost:8080/admin/login"
Write-Host "- Saisisseur : http://localhost:8080/saisisseur/login"
Write-Host "" 
Write-Host "Comptes demo:" -ForegroundColor Yellow
Write-Host "- ADMIN      -> admin@demo.local / Admin123!Demo"
Write-Host "- SAISISSEUR -> saisisseur@demo.local / Saisi123!Demo"
