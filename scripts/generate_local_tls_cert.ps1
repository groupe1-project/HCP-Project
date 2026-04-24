param(
    [Parameter(Mandatory = $true)]
    [string]$IpAddress,

    [int]$Days = 825
)

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$certDir = Join-Path $projectRoot "docker/nginx/certs"
New-Item -Path $certDir -ItemType Directory -Force | Out-Null

$resolvedCertDir = (Resolve-Path $certDir).Path
$dockerMount = "${resolvedCertDir}:/certs"
$subject = "/CN=$IpAddress"
$san = "subjectAltName=IP:$IpAddress,DNS:localhost,DNS:hcp.local"

Write-Host "Generating self-signed TLS certificate for $IpAddress ..."

& docker run --rm `
    -v $dockerMount `
    alpine/openssl `
    req -x509 -nodes -newkey rsa:2048 `
    -days $Days `
    -keyout /certs/local.key `
    -out /certs/local.crt `
    -subj $subject `
    -addext $san

if ($LASTEXITCODE -ne 0) {
    throw "Certificate generation failed. Ensure Docker Desktop is running."
}

Write-Host "Certificate files created:" -ForegroundColor Green
Write-Host "  $certDir/local.crt"
Write-Host "  $certDir/local.key"
Write-Host "Install local.crt in Trusted Root on each client PC to remove browser warning."