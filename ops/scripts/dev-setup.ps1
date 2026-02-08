#!/usr/bin/env pwsh
<#
.SYNOPSIS
    NextGen Marketplace - Isolated Development Environment Setup
.DESCRIPTION
    Sets up local development with hot reload, isolated node_modules, and pnpm
    No global npm dependencies required. Everything runs in project scope.
.EXAMPLE
    .\dev-setup.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Step($message) {
    Write-Host "${Blue}▶ ${message}${Reset}"
}

function Write-Success($message) {
    Write-Host "${Green}✓ ${message}${Reset}"
}

function Write-Warning($message) {
    Write-Host "${Yellow}⚠ ${message}${Reset}"
}

function Write-Error($message) {
    Write-Host "${Red}✗ ${message}${Reset}"
}

# Banner
Write-Host ""
Write-Host "${Blue}╔════════════════════════════════════════════════╗${Reset}"
Write-Host "${Blue}║  NextGen Marketplace - Dev Setup (Hot Reload) ║${Reset}"
Write-Host "${Blue}╚════════════════════════════════════════════════╝${Reset}"
Write-Host ""

# 1. Check Node.js
Write-Step "Checking Node.js version..."
try {
    $nodeVersion = node --version
    $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($nodeMajor -lt 20) {
        Write-Error "Node.js 20+ required. Current: $nodeVersion"
        exit 1
    }
    Write-Success "Node.js $nodeVersion detected"
} catch {
    Write-Error "Node.js not found. Install from https://nodejs.org/"
    exit 1
}

# 2. Install pnpm locally (via npm)
Write-Step "Setting up pnpm (local, no global install)..."
if (-not (Test-Path ".\node_modules\.bin\pnpm")) {
    npm install --no-save pnpm@latest
    Write-Success "pnpm installed locally"
} else {
    Write-Success "pnpm already available"
}

# 3. Create local pnpm alias for this session
$env:PATH = "$(Get-Location)\node_modules\.bin;$env:PATH"
$pnpmCmd = ".\node_modules\.bin\pnpm"

# 4. Configure pnpm to use local store
Write-Step "Configuring pnpm for isolated workspace..."
& $pnpmCmd config set store-dir "$(Get-Location)\.pnpm-store" --location project
& $pnpmCmd config set modules-dir "$(Get-Location)\node_modules" --location project
Write-Success "Workspace isolation configured"

# 5. Install root dependencies
Write-Step "Installing root dependencies..."
& $pnpmCmd install --frozen-lockfile --prefer-offline
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Lockfile missing or outdated. Running fresh install..."
    & $pnpmCmd install
}
Write-Success "Root dependencies installed"

# 6. Install workspace apps
Write-Step "Installing workspace applications..."
$apps = @("apps/web", "apps/api", "apps/worker", "apps/admin", "apps/vendor-portal")
foreach ($app in $apps) {
    if (Test-Path $app) {
        Write-Host "  → Installing $app..."
        Push-Location $app
        & ..\..\node_modules\.bin\pnpm install --frozen-lockfile --prefer-offline
        if ($LASTEXITCODE -ne 0) {
            & ..\..\node_modules\.bin\pnpm install
        }
        Pop-Location
        Write-Success "$app ready"
    }
}

# 7. Setup environment files
Write-Step "Checking environment configuration..."
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Warning ".env created from .env.example - EDIT SECRETS BEFORE RUNNING!"
    } else {
        Write-Warning "No .env.example found"
    }
} else {
    Write-Success ".env exists"
}

# Check apps/.env
$appEnvs = @("apps/web/.env", "apps/api/.env")
foreach ($envFile in $appEnvs) {
    $exampleFile = "$envFile.example"
    if (-not (Test-Path $envFile)) {
        if (Test-Path $exampleFile) {
            Copy-Item $exampleFile $envFile
            Write-Warning "$envFile created - CONFIGURE BEFORE RUNNING!"
        }
    }
}

# 8. Start Docker services (Postgres, Redis, MinIO, MeiliSearch)
Write-Step "Starting Docker infrastructure..."
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker compose up -d postgres redis minio meilisearch 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker services started (postgres, redis, minio, meilisearch)"
        Start-Sleep -Seconds 3
    } else {
        Write-Warning "Docker services not started. Run manually: docker compose up -d"
    }
} else {
    Write-Warning "Docker not found. Install Docker Desktop for infrastructure services."
}

# 9. Generate Prisma Client
Write-Step "Generating Prisma Client..."
if (Test-Path "prisma/schema.prisma") {
    & $pnpmCmd exec prisma generate
    Write-Success "Prisma Client generated"
}

# 10. Create dev runner script
Write-Step "Creating hot reload runner (dev-start.ps1)..."
$devScript = @'
#!/usr/bin/env pwsh
# Hot Reload Development Server
$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting NextGen Marketplace (Hot Reload Mode)..." -ForegroundColor Cyan
Write-Host ""

# Kill existing processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*nextgen-market*" } | Stop-Process -Force

# Start API (NestJS with watch mode)
Write-Host "▶ Starting API (http://localhost:3000)..." -ForegroundColor Blue
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd apps/api; pnpm run start:dev" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Web (Next.js with fast refresh)
Write-Host "▶ Starting Web (http://localhost:3001)..." -ForegroundColor Blue
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd apps/web; pnpm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Admin (Next.js with fast refresh)
Write-Host "▶ Starting Admin (http://localhost:3002)..." -ForegroundColor Blue
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd apps/admin; pnpm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Vendor Portal (Next.js with fast refresh)
Write-Host "▶ Starting Vendor Portal (http://localhost:3003)..." -ForegroundColor Blue
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd apps/vendor-portal; pnpm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✓ All services started with hot reload!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs:" -ForegroundColor Yellow
Write-Host "  API:           http://localhost:3000" -ForegroundColor White
Write-Host "  Web:           http://localhost:3001" -ForegroundColor White
Write-Host "  Admin:         http://localhost:3002" -ForegroundColor White
Write-Host "  Vendor Portal: http://localhost:3003" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C in each terminal to stop services" -ForegroundColor DarkGray
'@

Set-Content -Path "dev-start.ps1" -Value $devScript -Encoding UTF8
Write-Success "dev-start.ps1 created"

# 11. Summary
Write-Host ""
Write-Host "${Green}╔════════════════════════════════════════════════╗${Reset}"
Write-Host "${Green}║           Setup Complete! ✓                    ║${Reset}"
Write-Host "${Green}╚════════════════════════════════════════════════╝${Reset}"
Write-Host ""
Write-Host "${Yellow}Next Steps:${Reset}"
Write-Host "  1. Edit ${Blue}.env${Reset} files (API, Web, Admin)"
Write-Host "  2. Run: ${Blue}.\dev-start.ps1${Reset}"
Write-Host "  3. Code changes = ${Green}Instant Hot Reload${Reset}"
Write-Host ""
Write-Host "${Yellow}Useful Commands:${Reset}"
Write-Host "  ${Blue}.\node_modules\.bin\pnpm run dev${Reset}      - Run specific app"
Write-Host "  ${Blue}docker compose ps${Reset}                     - Check Docker services"
Write-Host "  ${Blue}.\node_modules\.bin\pnpm exec prisma studio${Reset} - Database GUI"
Write-Host ""
Write-Host "${Green}Happy coding! 🚀${Reset}"
Write-Host ""
