param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipSecurityPreflight
)

$ErrorActionPreference = "Stop"

function Get-PythonCommand {
    $candidates = @(
        "./.venv/Scripts/python.exe",
        "./venv/Scripts/python.exe"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return (Resolve-Path $candidate).Path
        }
    }

    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) {
        return "py -3"
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
        return "python"
    }

    throw "Python interpreter not found. Activate/create a virtual environment first."
}

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    Write-Host "`n=== $Name ===" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed: $Name (exit code $LASTEXITCODE)"
    }
    Write-Host "OK: $Name" -ForegroundColor Green
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$pythonCmd = Get-PythonCommand
Write-Host "Using Python: $pythonCmd"
Write-Host "Repo root: $repoRoot"

if (-not $SkipBackend) {
    Invoke-Step "Backend: Django check" {
        Invoke-Expression "$pythonCmd manage.py check"
    }

    Invoke-Step "Backend: tests core.tests" {
        Invoke-Expression "$pythonCmd manage.py test core.tests -v 2"
    }

    if (-not $SkipSecurityPreflight) {
        Invoke-Step "Backend: security preflight" {
            Invoke-Expression "$pythonCmd scripts/security_preflight.py"
        }
    }
}

if (-not $SkipFrontend) {
    Push-Location "$repoRoot/frontend"
    try {
        Invoke-Step "Frontend: lint" {
            npm run lint
        }

        Invoke-Step "Frontend: build" {
            npm run build
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host "`nPre-release checks completed successfully." -ForegroundColor Green
Write-Host "Safe to proceed with delivery/deployment workflow." -ForegroundColor Green
