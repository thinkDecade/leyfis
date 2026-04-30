# deploy-app.ps1 — Build and deploy leyfis-app to Netlify
# Run from repo root: .\scripts\deploy-app.ps1
#
# Note: The leyfis-app GitHub webhook is currently disconnected.
# This script builds locally and deploys directly to Netlify production.
# Admin site (leyfis-admin) auto-deploys from git push as normal.

$ErrorActionPreference = "Stop"
$repo = $PSScriptRoot | Split-Path -Parent

Write-Host "`n[1/2] Building leyfis-app..." -ForegroundColor Cyan
Set-Location "$repo\app"
yarn workspace @leyfis/app build

Write-Host "`n[2/2] Deploying to Netlify..." -ForegroundColor Cyan
Set-Location "$repo\app\apps\app"
$env:NETLIFY_AUTH_TOKEN = "nfc_RXQ9aacsUsnW1A5t9B9VjasxPcJQ9hnT4319"
$env:NETLIFY_SITE_ID = "ce186f9d-3aa3-4cfb-ae08-6ee670af90d6"
netlify deploy --prod --dir=out --no-build

Write-Host "`n✓ Done. Live at https://leyfis-app.netlify.app" -ForegroundColor Green
