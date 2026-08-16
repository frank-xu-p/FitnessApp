# Fitness App Local Setup Script
# Run from PowerShell in the workspace root:
#   .\setup.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition

function Test-Command($cmd) {
  return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Stop-OnFailure($message) {
  if ($LASTEXITCODE -ne 0) {
    throw $message
  }
}

Write-Host "=== Fitness App Local Setup ===" -ForegroundColor Cyan

# Check prerequisites
if (-not (Test-Command "pnpm")) {
  Write-Error "pnpm is not installed. Install it with: npm install -g pnpm"
}
if (-not (Test-Command "wrangler")) {
  Write-Error "wrangler is not installed. Install it with: npm install -g wrangler"
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Set-Location $root
pnpm install
Stop-OnFailure "pnpm install failed. Fix the errors above and run the script again."

# Verify tsx is available
$tsxPath = [System.IO.Path]::Combine($root, "node_modules", ".bin", "tsx.ps1")
if (-not (Test-Path $tsxPath)) {
  throw "tsx was not installed. Check the pnpm install output above for errors."
}

# Download free-exercise-db dataset
Write-Host ""
Write-Host "Downloading free-exercise-db dataset..." -ForegroundColor Yellow
$datasetUrl = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"

# Backend seed location
$schemaDataDir = [System.IO.Path]::Combine($root, "packages", "db-schema", "data")
New-Item -ItemType Directory -Force -Path $schemaDataDir | Out-Null
$schemaDatasetPath = [System.IO.Path]::Combine($schemaDataDir, "exercises.json")

# Mobile asset location
$mobileAssetsDir = [System.IO.Path]::Combine($root, "apps", "mobile", "assets", "data")
New-Item -ItemType Directory -Force -Path $mobileAssetsDir | Out-Null
$mobileDatasetPath = [System.IO.Path]::Combine($mobileAssetsDir, "exercises.json")

try {
  Invoke-WebRequest -Uri $datasetUrl -OutFile $schemaDatasetPath -UseBasicParsing
  Copy-Item -Path $schemaDatasetPath -Destination $mobileDatasetPath -Force
  Write-Host "Downloaded dataset to packages/db-schema/data/exercises.json and apps/mobile/assets/data/exercises.json" -ForegroundColor Green
}
catch {
  throw "Failed to download free-exercise-db dataset. Check your internet connection."
}

# Backend secrets
$backendEnv = [System.IO.Path]::Combine($root, "packages", "backend", ".dev.vars")
$secret = Read-Host "Enter a BETTER_AUTH_SECRET (long random string, press Enter to keep placeholder)"
if ($secret) {
  "BETTER_AUTH_SECRET=$secret" | Out-File -FilePath $backendEnv -Encoding utf8
  Write-Host "Updated packages/backend/.dev.vars" -ForegroundColor Green
}
else {
  Write-Host "Kept placeholder in packages/backend/.dev.vars. You must replace it before running." -ForegroundColor Yellow
}

# Cloudflare D1
Write-Host ""
Write-Host "Creating D1 database if it doesn't exist..." -ForegroundColor Yellow
$d1List = (wrangler d1 list) -join "`n"
Stop-OnFailure "wrangler d1 list failed"
if ($d1List -notmatch "fitness-db") {
  $d1Create = (wrangler d1 create fitness-db) -join "`n"
  Stop-OnFailure "wrangler d1 create failed"
  Write-Host $d1Create
  $dbId = [regex]::Match($d1Create, '"database_id"\s*:\s*"([0-9a-f\-]{36})"').Groups[1].Value
  if ($dbId) {
    $wranglerTomlPath = [System.IO.Path]::Combine($root, "packages", "backend", "wrangler.toml")
    $wranglerToml = Get-Content $wranglerTomlPath -Raw
    $wranglerToml = $wranglerToml -replace 'database_id = "[0-9a-f\-]*"', "database_id = `"$dbId`""
    $wranglerToml | Out-File $wranglerTomlPath -Encoding utf8
    Write-Host "Updated wrangler.toml with database_id $dbId" -ForegroundColor Green
  }
  else {
    Write-Warning "Could not extract database_id from wrangler output. Update packages/backend/wrangler.toml manually."
  }
}
else {
  Write-Host "D1 database 'fitness-db' already exists." -ForegroundColor Green
}

# Cloudflare R2
Write-Host ""
Write-Host "Creating R2 bucket if it doesn't exist..." -ForegroundColor Yellow
$r2List = (wrangler r2 bucket list) -join "`n"
if ($LASTEXITCODE -ne 0) {
  if ($r2List -match "Please enable R2") {
    Write-Warning "R2 is not enabled on this Cloudflare account. The AI video importer will not work until you enable R2 in the Cloudflare Dashboard. Continuing setup..."
  }
  else {
    Stop-OnFailure "wrangler r2 bucket list failed"
  }
}
elseif ($r2List -notmatch "fitness-media") {
  wrangler r2 bucket create fitness-media
  Stop-OnFailure "wrangler r2 bucket create failed"
}
else {
  Write-Host "R2 bucket 'fitness-media' already exists." -ForegroundColor Green
}

# Migrations and seed
Write-Host ""
Write-Host "Running D1 migrations..." -ForegroundColor Yellow
pnpm --filter @fitness-app/backend db:migrate:local
Stop-OnFailure "D1 migrations failed"

Write-Host ""
Write-Host "Seeding base exercises..." -ForegroundColor Yellow
pnpm --filter @fitness-app/backend db:seed:local
Stop-OnFailure "Exercise seed failed"

Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Cyan
Write-Host "To start the backend: pnpm --filter @fitness-app/backend dev" -ForegroundColor White
Write-Host "To start the mobile app: pnpm --filter @fitness-app/mobile dev" -ForegroundColor White
Write-Host ""
Write-Host "Important:" -ForegroundColor Yellow
Write-Host "- Replace the placeholder in packages/backend/.dev.vars if you kept it."
Write-Host "- The AI video importer and sync require a running backend."
