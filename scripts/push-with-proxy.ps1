# Usage (PowerShell): set proxy to match your VPN app (example 7890), then:
#   .\scripts\push-with-proxy.ps1
# Clears proxy after push. Edit $ProxyUrl if your port differs.

$ProxyUrl = "http://127.0.0.1:7890"

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

git config http.proxy $ProxyUrl
git config https.proxy $ProxyUrl
try {
    git push origin main
} finally {
    git config --unset http.proxy 2>$null
    git config --unset https.proxy 2>$null
}
