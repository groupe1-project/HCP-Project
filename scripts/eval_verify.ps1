Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Verification health endpoint..." -ForegroundColor Cyan
$health = Invoke-RestMethod -Method Get -Uri "http://localhost:8080/health/"
$health | ConvertTo-Json -Depth 4

Write-Host "Verification login ADMIN..." -ForegroundColor Cyan
$adminLogin = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/auth/login/" -ContentType "application/json" -Body '{"email":"admin@demo.local","password":"Admin123!Demo"}'
$adminLogin | ConvertTo-Json -Depth 4

Write-Host "Verification login SAISISSEUR..." -ForegroundColor Cyan
$saisLogin = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/auth/login/" -ContentType "application/json" -Body '{"email":"saisisseur@demo.local","password":"Saisi123!Demo"}'
$saisLogin | ConvertTo-Json -Depth 4

Write-Host "Verification OK." -ForegroundColor Green
