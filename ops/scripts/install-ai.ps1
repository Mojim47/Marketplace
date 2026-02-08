# ═══════════════════════════════════════════════════════════════════════════
# AI Revolution - Installation Script
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Install all AI dependencies and prepare system
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "🤖 NextGen Marketplace - AI Revolution Installation" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if running in correct directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Run this script from project root." -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Installing AI SDK dependencies..." -ForegroundColor Yellow
npm install --save ai chart.js react-chartjs-2

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✅ AI SDK installed successfully" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Checking environment configuration..." -ForegroundColor Yellow

# Check if .env exists
if (!(Test-Path ".env")) {
    Write-Host "⚠️  .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ .env file created" -ForegroundColor Green
} else {
    Write-Host "✅ .env file exists" -ForegroundColor Green
}

Write-Host ""

# Check for required API keys
Write-Host "Step 3: Validating API keys..." -ForegroundColor Yellow

$envContent = Get-Content ".env" -Raw

$missingKeys = @()

if ($envContent -notmatch "OPENAI_API_KEY=sk-") {
    $missingKeys += "OPENAI_API_KEY"
}

if ($missingKeys.Count -gt 0) {
    Write-Host "⚠️  Missing API keys in .env:" -ForegroundColor Yellow
    foreach ($key in $missingKeys) {
        Write-Host "   - $key" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Please add these keys to your .env file:" -ForegroundColor Cyan
    Write-Host "1. Get OpenAI key from: https://platform.openai.com/api-keys" -ForegroundColor Cyan
    Write-Host "2. Get Meshy key from: https://app.meshy.ai/api-keys (optional)" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "✅ All required API keys configured" -ForegroundColor Green
}

Write-Host ""

Write-Host "Step 4: Checking database schema..." -ForegroundColor Yellow

# Check if Prisma schema has AI fields
$schemaContent = Get-Content "prisma\schema.prisma" -Raw

if ($schemaContent -match "arModelUrl" -and $schemaContent -match "metaKeywords") {
    Write-Host "✅ Database schema includes AI fields" -ForegroundColor Green
} else {
    Write-Host "⚠️  Database schema may need migration" -ForegroundColor Yellow
    Write-Host "   Run: npx prisma migrate dev --name add_ai_fields" -ForegroundColor Cyan
}

Write-Host ""

Write-Host "Step 5: Building worker service..." -ForegroundColor Yellow

npm run docker:build:worker

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Worker service built successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  Worker build failed. This is expected if Docker is not running." -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎉 Installation Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Add API keys to .env file (if not already done)" -ForegroundColor White
Write-Host "   - OPENAI_API_KEY=sk-proj-..." -ForegroundColor Gray
Write-Host "   - MESHY_API_KEY=msy-... (optional)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Run database migration:" -ForegroundColor White
Write-Host "   npx prisma migrate dev --name add_ai_fields" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start worker service:" -ForegroundColor White
Write-Host "   docker compose up -d worker" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Test AI features:" -ForegroundColor White
Write-Host "   - Upload a product (auto content generation)" -ForegroundColor Gray
Write-Host "   - Visit /admin/ar-generation (3D model creation)" -ForegroundColor Gray
Write-Host "   - Open admin dashboard (AI assistant chatbot)" -ForegroundColor Gray
Write-Host ""

Write-Host "📖 Documentation:" -ForegroundColor Cyan
Write-Host "   - AI_QUICK_START.md (Quick setup guide)" -ForegroundColor Gray
Write-Host "   - docs/AI_INTEGRATION.md (Complete documentation)" -ForegroundColor Gray
Write-Host ""

Write-Host "💰 Estimated Costs (with 1000 products/month):" -ForegroundColor Cyan
Write-Host "   - Content Generation: ~$0.30/month" -ForegroundColor Gray
Write-Host "   - AR Models: ~$20/month (100 models)" -ForegroundColor Gray
Write-Host "   - AI Assistant: ~$0.30/month (500 queries)" -ForegroundColor Gray
Write-Host "   Total: ~$20.60/month" -ForegroundColor Gray
Write-Host ""

Write-Host "🆓 Free Alternatives:" -ForegroundColor Cyan
Write-Host "   - Install Ollama for local AI (free): https://ollama.ai" -ForegroundColor Gray
Write-Host "   - Run: ollama pull llama3.2" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ AI Revolution is ready to deploy!" -ForegroundColor Green
Write-Host ""

# Check if user wants to run migration now
$response = Read-Host "Do you want to run database migration now? (y/n)"

if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host ""
    Write-Host "Running database migration..." -ForegroundColor Yellow
    npx prisma migrate dev --name add_ai_fields
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database migration completed" -ForegroundColor Green
    } else {
        Write-Host "❌ Migration failed. Please check the error above." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🚀 Ready to revolutionize your marketplace with AI!" -ForegroundColor Cyan
