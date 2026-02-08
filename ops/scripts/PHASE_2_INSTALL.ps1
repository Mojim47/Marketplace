# Quick Setup Script
# Run: .\PHASE_2_INSTALL.ps1

Write-Host "Installing Phase 2 Dependencies..." -ForegroundColor Cyan

# Use pnpm
$packageManager = "pnpm"
Write-Host "Using pnpm" -ForegroundColor Green


# Save current location
$rootPath = Get-Location

# Install next-pwa in web app
Write-Host ""
Write-Host "Installing next-pwa in apps/web..." -ForegroundColor Yellow
Set-Location "$rootPath\apps\web"

pnpm add next-pwa


# Install @nestjs/swagger in api
Write-Host ""
Write-Host "Installing @nestjs/swagger in apps/api..." -ForegroundColor Yellow
Set-Location "$rootPath\apps\api"

pnpm add @nestjs/swagger swagger-ui-express
pnpm add -D @types/swagger-ui-express


# Return to root
Set-Location $rootPath

Write-Host ""
Write-Host "All dependencies installed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Generate PWA icons (72x72 to 512x512)" -ForegroundColor White
Write-Host "  2. Run validation: npx tsx prisma/validate-seed.ts" -ForegroundColor White
Write-Host "  3. Start dev server: pnpm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Phase 2 setup complete!" -ForegroundColor Green
