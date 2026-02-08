#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Deployment Readiness Verification
# ═══════════════════════════════════════════════════════════════════════════
# Verifies that the project is ready for deployment by checking:
# 1. Lock file exists (pnpm-lock.yaml)
# 2. Project builds successfully
# ═══════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🔍 NextGen Marketplace - Deployment Readiness Check" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 1: Check for pnpm-lock.yaml
# ═══════════════════════════════════════════════════════════════════════════
Write-Host "📦 Step 1: Checking for lockfile..." -ForegroundColor Yellow

$lockfilePath = Join-Path $PSScriptRoot "pnpm-lock.yaml"

if (Test-Path $lockfilePath) {
    Write-Host "✅ pnpm-lock.yaml found" -ForegroundColor Green
    $lockfileSize = (Get-Item $lockfilePath).Length / 1KB
    Write-Host "   Size: $([math]::Round($lockfileSize, 2)) KB" -ForegroundColor Gray
} else {
    Write-Host "❌ ERROR: pnpm-lock.yaml not found!" -ForegroundColor Red
    Write-Host "   Run: pnpm install" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 2: Build the project
# ═══════════════════════════════════════════════════════════════════════════
Write-Host "🔨 Step 2: Building project..." -ForegroundColor Yellow

try {
    $buildOutput = & pnpm run build 2>&1
    $buildExitCode = $LASTEXITCODE

    if ($buildExitCode -eq 0) {
        Write-Host "✅ Build successful" -ForegroundColor Green
    } else {
        Write-Host "❌ Build failed with exit code: $buildExitCode" -ForegroundColor Red
        Write-Host "Build output:" -ForegroundColor Yellow
        Write-Host $buildOutput -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "❌ Build error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# Final Status
# ═══════════════════════════════════════════════════════════════════════════
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ READY FOR DEPLOYMENT" -ForegroundColor Green -BackgroundColor Black
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Checklist:" -ForegroundColor Cyan
Write-Host "   ✓ pnpm-lock.yaml exists" -ForegroundColor Green
Write-Host "   ✓ Project builds successfully" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Cyan
Write-Host "   • Review environment variables (.env)" -ForegroundColor White
Write-Host "   • Run: docker-compose up --build" -ForegroundColor White
Write-Host "   • Deploy to production" -ForegroundColor White
Write-Host ""

exit 0
