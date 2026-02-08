#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Dependency Installation Script (PowerShell)
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Install all required npm packages for enterprise services
# Usage: .\install-enterprise-deps.ps1
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "🚀 Installing NextGen Marketplace Enterprise Dependencies..." -ForegroundColor Green
Write-Host ""

# ───────────────────────────────────────────────────────────────────────────
# Root Dependencies
# ───────────────────────────────────────────────────────────────────────────
Write-Host "📦 Installing root dependencies..." -ForegroundColor Yellow
npm install

# ───────────────────────────────────────────────────────────────────────────
# Storage Service Dependencies
# ───────────────────────────────────────────────────────────────────────────
Write-Host "📦 Installing Storage Service (MinIO/S3) dependencies..." -ForegroundColor Yellow
Push-Location libs\storage
npm install @aws-sdk/client-s3@^3.645.0
npm install @aws-sdk/s3-request-presigner@^3.645.0
npm install @aws-sdk/lib-storage@^3.645.0
Pop-Location

# ───────────────────────────────────────────────────────────────────────────
# Search Service Dependencies
# ───────────────────────────────────────────────────────────────────────────
Write-Host "📦 Installing Search Service (MeiliSearch) dependencies..." -ForegroundColor Yellow
Push-Location libs\search
npm install meilisearch@^0.39.0
Pop-Location

# ───────────────────────────────────────────────────────────────────────────
# Queue Service Dependencies
# ───────────────────────────────────────────────────────────────────────────
Write-Host "📦 Installing Queue Service (BullMQ) dependencies..." -ForegroundColor Yellow
Push-Location libs\queue
npm install bullmq@^5.13.0
npm install ioredis@^5.4.1
npm install sharp@^0.33.5
Pop-Location

# ───────────────────────────────────────────────────────────────────────────
# Worker Service Dependencies
# ───────────────────────────────────────────────────────────────────────────
Write-Host "📦 Installing Worker Service dependencies..." -ForegroundColor Yellow
Push-Location apps\worker
npm install bullmq@^5.13.0
npm install ioredis@^5.4.1
npm install sharp@^0.33.5
npm install axios@^1.7.0
npm install nodemailer@^6.9.15
npm install pino@^9.2.0
npm install pino-pretty@^11.0.0
npm install dotenv@^16.3.1
npm install --save-dev @types/nodemailer@^6.4.15
Pop-Location

# ───────────────────────────────────────────────────────────────────────────
# Web App SEO Dependencies
# ───────────────────────────────────────────────────────────────────────────
Write-Host "📦 Installing SEO dependencies (next-sitemap)..." -ForegroundColor Yellow
Push-Location apps\web
npm install next-sitemap@^4.2.3
Pop-Location

# ───────────────────────────────────────────────────────────────────────────
# Summary
# ───────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ All dependencies installed successfully!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Installed Services:" -ForegroundColor Cyan
Write-Host "  ✓ MinIO Storage (S3-compatible)" -ForegroundColor White
Write-Host "  ✓ MeiliSearch (Search Engine)" -ForegroundColor White
Write-Host "  ✓ BullMQ (Job Queue)" -ForegroundColor White
Write-Host "  ✓ Worker Service (Background Jobs)" -ForegroundColor White
Write-Host "  ✓ SEO Components (next-sitemap)" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Copy .env.example to .env" -ForegroundColor White
Write-Host "  2. Update environment variables" -ForegroundColor White
Write-Host "  3. Run: npm run docker:build:worker" -ForegroundColor White
Write-Host "  4. Run: npm run docker:up:prod" -ForegroundColor White
Write-Host ""
Write-Host "📖 Documentation:" -ForegroundColor Yellow
Write-Host "  - docs/ENTERPRISE_SERVICES_GUIDE.md" -ForegroundColor White
Write-Host "  - docs/DEPLOYMENT_CHECKLIST.md" -ForegroundColor White
Write-Host "  - docs/IMPLEMENTATION_SUMMARY.md" -ForegroundColor White
Write-Host ""
