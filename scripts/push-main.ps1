# Run in PowerShell when https://github.com is reachable (e.g. after Spv / hotspot works).
# Right-click → Run with PowerShell, or:  powershell -ExecutionPolicy Bypass -File .\scripts\push-main.ps1

$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Repo: $(Get-Location)"
Write-Host "Pushing main -> origin ..."
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Push failed. If it says non-fast-forward / rejected, run first:"
  Write-Host "  git pull origin main --no-rebase"
  Write-Host "Then run this script again."
  pause
  exit $LASTEXITCODE
}

Write-Host "Done."
pause
