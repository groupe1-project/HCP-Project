param(
    [Parameter(Mandatory = $true)]
    [string]$HealthUrl
)

$ErrorActionPreference = "Stop"

Write-Host "Checking health endpoint: $HealthUrl"

try {
    $response = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 20
} catch {
    throw "Health check request failed: $($_.Exception.Message)"
}

if ($null -eq $response) {
    throw "Health check failed: empty response"
}

if (-not $response.ready) {
    throw "Health check failed: ready=false"
}

Write-Host "Health check OK (ready=true)."
if ($response.status) {
    Write-Host "Status: $($response.status)"
}
