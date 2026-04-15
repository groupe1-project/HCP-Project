Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Recreation/mise a jour des comptes demo..." -ForegroundColor Cyan
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

Write-Host "Comptes demo prets:" -ForegroundColor Green
Write-Host "- ADMIN      -> admin@demo.local / Admin123!Demo"
Write-Host "- SAISISSEUR -> saisisseur@demo.local / Saisi123!Demo"
