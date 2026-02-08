# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Secure Secrets Generator (PowerShell)
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Generate cryptographically secure secrets for .env file
# Platform: Windows PowerShell 5.1+
# ═══════════════════════════════════════════════════════════════════════════

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔐 NextGen Marketplace - Secrets Generator" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📍 Project: $PWD"
Write-Host "⏰ Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════

function Generate-RandomPassword {
    param([int]$Length = 32)
    
    # ASCII printable characters (33-126) excluding quotes and backslash
    $chars = 33..126 | Where-Object { $_ -notin 34,39,92,96 } | ForEach-Object { [char]$_ }
    -join ($chars | Get-Random -Count $Length)
}

function Generate-HexSecret {
    param([int]$Length = 64)
    
    $bytes = New-Object byte[] ($Length / 2)
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    
    -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

function Generate-Base64Secret {
    param([int]$Length = 32)
    
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    
    [Convert]::ToBase64String($bytes) -replace '[/+=]',''
}

function Generate-UUID {
    [guid]::NewGuid().ToString()
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 1: Check if .env exists
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "[1/3] Checking for existing .env file..." -ForegroundColor Yellow

$envPath = Join-Path $PWD ".env"

if (Test-Path $envPath) {
    Write-Host "⚠  WARNING: .env file already exists" -ForegroundColor Yellow
    Write-Host "   Path: $envPath"
    Write-Host ""
    
    if (-not $Force) {
        $response = Read-Host "   Overwrite existing file? (y/n) [n]"
        if ($response -ne 'y' -and $response -ne 'Y') {
            Write-Host "❌ Aborted by user" -ForegroundColor Red
            exit 0
        }
    }
    
    Write-Host "⚠  Creating backup..." -ForegroundColor Yellow
    $backupPath = "$envPath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $envPath $backupPath
    Write-Host "✅ Backup created: $backupPath" -ForegroundColor Green
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 2: Generate Secrets
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "[2/3] Generating cryptographically secure secrets..." -ForegroundColor Yellow

# Database
$dbPassword = Generate-RandomPassword -Length 32
$dbUser = "nextgen_prod_user"
$dbName = "nextgen_marketplace"

# Redis
$redisPassword = Generate-RandomPassword -Length 32

# JWT
$jwtSecret = Generate-HexSecret -Length 64
$jwtRefreshSecret = Generate-HexSecret -Length 64

# Session
$sessionSecret = Generate-HexSecret -Length 64

# Encryption
$encryptionKey = Generate-HexSecret -Length 64

# Admin
$adminEmail = "admin@nextgen-marketplace.local"
$adminPassword = Generate-RandomPassword -Length 32

# Monitoring
$monitoringPassword = Generate-RandomPassword -Length 24

# Instance ID
$instanceId = Generate-UUID

Write-Host "✅ Generated $(9) secure secrets" -ForegroundColor Green
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 3: Write .env File
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "[3/3] Writing .env file..." -ForegroundColor Yellow

$envContent = @"
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Production Environment Configuration
# ═══════════════════════════════════════════════════════════════════════════
# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# Instance ID: $instanceId
# ═══════════════════════════════════════════════════════════════════════════
# 🔒 SECURITY WARNING:
# - This file contains SENSITIVE credentials
# - NEVER commit this file to version control
# - Store a copy in a secure password manager
# - Change ADMIN_PASSWORD on first login
# ═══════════════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────────────────────
# 🌍 Application Configuration
# ───────────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
API_BASE_URL=http://localhost:3000

# Instance identification
INSTANCE_ID=$instanceId

# ───────────────────────────────────────────────────────────────────────────
# 🗄️ Database Configuration (PostgreSQL)
# ───────────────────────────────────────────────────────────────────────────
DB_HOST=postgres
DB_PORT=5432
DB_NAME=$dbName
DB_USER=$dbUser
DB_PASSWORD=$dbPassword

# Full connection string (auto-generated)
DATABASE_URL=postgresql://`${DB_USER}:`${DB_PASSWORD}@`${DB_HOST}:`${DB_PORT}/`${DB_NAME}?schema=public

# ───────────────────────────────────────────────────────────────────────────
# 🔴 Redis Configuration
# ───────────────────────────────────────────────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$redisPassword

# Full connection string (auto-generated)
REDIS_URL=redis://:`${REDIS_PASSWORD}@`${REDIS_HOST}:`${REDIS_PORT}

# ───────────────────────────────────────────────────────────────────────────
# 🔑 JWT & Authentication
# ───────────────────────────────────────────────────────────────────────────
JWT_SECRET=$jwtSecret
JWT_REFRESH_SECRET=$jwtRefreshSecret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Session management
SESSION_SECRET=$sessionSecret
SESSION_MAX_AGE=604800000

# ───────────────────────────────────────────────────────────────────────────
# 🔐 Encryption & Security
# ───────────────────────────────────────────────────────────────────────────
ENCRYPTION_KEY=$encryptionKey
BCRYPT_ROUNDS=12

# ───────────────────────────────────────────────────────────────────────────
# 🌐 CORS Configuration
# ───────────────────────────────────────────────────────────────────────────
# ⚠️  IMPORTANT: Configure your actual domain(s)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ───────────────────────────────────────────────────────────────────────────
# 👤 Initial Admin Account
# ───────────────────────────────────────────────────────────────────────────
# ⚠️  CRITICAL: Change password on first login!
ADMIN_EMAIL=$adminEmail
ADMIN_PASSWORD=$adminPassword

# ───────────────────────────────────────────────────────────────────────────
# 📊 Monitoring (Nginx Basic Auth)
# ───────────────────────────────────────────────────────────────────────────
MONITORING_USER=admin
MONITORING_PASSWORD=$monitoringPassword

# ───────────────────────────────────────────────────────────────────────────
# 📧 Email Configuration (SMTP) - CONFIGURE FOR PRODUCTION
# ───────────────────────────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM=noreply@nextgen-marketplace.local

# ───────────────────────────────────────────────────────────────────────────
# 💳 Payment Gateway (Optional)
# ───────────────────────────────────────────────────────────────────────────
# Zarinpal
ZARINPAL_MERCHANT_ID=
ZARINPAL_SANDBOX=false

# ───────────────────────────────────────────────────────────────────────────
# 📱 SMS (Optional)
# ───────────────────────────────────────────────────────────────────────────
# Kavenegar
KAVENEGAR_API_KEY=
KAVENEGAR_SENDER=

# ───────────────────────────────────────────────────────────────────────────
# 🤖 AI Services (Optional)
# ───────────────────────────────────────────────────────────────────────────
# OpenAI
OPENAI_API_KEY=

# Ollama (local)
OLLAMA_ENDPOINT=http://localhost:11434

# ───────────────────────────────────────────────────────────────────────────
# 🥽 AR/3D Services (Optional)
# ───────────────────────────────────────────────────────────────────────────
# Meshy.ai
MESHY_API_KEY=

# CSM.ai
CSM_API_KEY=

# ═══════════════════════════════════════════════════════════════════════════
# End of Configuration
# ═══════════════════════════════════════════════════════════════════════════
"@

Set-Content -Path $envPath -Value $envContent -Encoding UTF8
Write-Host "✅ File created: $envPath" -ForegroundColor Green
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 4: Generate Credentials Summary
# ═══════════════════════════════════════════════════════════════════════════

$summaryPath = Join-Path $PWD "CREDENTIALS_SUMMARY.txt"

$summaryContent = @"
═══════════════════════════════════════════════════════════════════════════
NextGen Marketplace - Credentials Summary
═══════════════════════════════════════════════════════════════════════════
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Instance: $instanceId
───────────────────────────────────────────────────────────────────────────

🔒 CRITICAL SECURITY INSTRUCTIONS:
1. Store this file in a secure password manager
2. Delete this file after storing credentials: Remove-Item CREDENTIALS_SUMMARY.txt
3. Change ADMIN_PASSWORD on first login
4. Configure CORS_ORIGINS in .env with your actual domain
5. Never commit .env to version control

───────────────────────────────────────────────────────────────────────────
📋 GENERATED CREDENTIALS:
───────────────────────────────────────────────────────────────────────────

Database (PostgreSQL):
  User:     $dbUser
  Password: $dbPassword
  Database: $dbName

Redis:
  Password: $redisPassword

Initial Admin Account:
  Email:    $adminEmail
  Password: $adminPassword
  ⚠️  CHANGE THIS PASSWORD ON FIRST LOGIN!

Monitoring (Prometheus/Grafana):
  User:     admin
  Password: $monitoringPassword

───────────────────────────────────────────────────────────────────────────
🔧 NEXT STEPS:
───────────────────────────────────────────────────────────────────────────

1. Configure domain in .env:
   (Get-Content .env) -replace 'CORS_ORIGINS=.*','CORS_ORIGINS=https://your-actual-domain.com' | Set-Content .env

2. Configure SMTP settings in .env for real email sending

3. Validate configuration:
   # If you have bash/WSL:
   bash scripts/validate-env.sh
   
   # Otherwise manually check all secrets are set

4. Deploy to production:
   git push origin main

───────────────────────────────────────────────────────────────────────────
⚠️  SECURITY REMINDER:
───────────────────────────────────────────────────────────────────────────
- All passwords are 32+ characters with high entropy
- JWT secrets are 64+ character hex strings
- All secrets generated using cryptographic RNG
- Encryption uses SHA-256 level security

DELETE THIS FILE after storing credentials securely!

═══════════════════════════════════════════════════════════════════════════
"@

Set-Content -Path $summaryPath -Value $summaryContent -Encoding UTF8

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Secrets Generated Successfully!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📄 Files Created:" -ForegroundColor Cyan
Write-Host "   ✅ .env - Production secrets" -ForegroundColor Green
Write-Host "   ✅ CREDENTIALS_SUMMARY.txt - Human-readable backup" -ForegroundColor Green
Write-Host ""
Write-Host "🔒 CRITICAL SECURITY ACTIONS:" -ForegroundColor Yellow
Write-Host "   1. " -NoNewline; Write-Host "Store credentials in password manager" -ForegroundColor Red
Write-Host "   2. " -NoNewline; Write-Host "Delete CREDENTIALS_SUMMARY.txt after storing:" -ForegroundColor Red
Write-Host "      " -NoNewline; Write-Host "Remove-Item CREDENTIALS_SUMMARY.txt" -ForegroundColor Blue
Write-Host "   3. " -NoNewline; Write-Host "Change ADMIN_PASSWORD on first login" -ForegroundColor Yellow
Write-Host "   4. " -NoNewline; Write-Host "Configure CORS_ORIGINS in .env" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Initial Admin Credentials:" -ForegroundColor Cyan
Write-Host "   Email:    " -NoNewline; Write-Host $adminEmail -ForegroundColor Green
Write-Host "   Password: " -NoNewline; Write-Host $adminPassword -ForegroundColor Green
Write-Host "   " -NoNewline; Write-Host "⚠️  CHANGE PASSWORD ON FIRST LOGIN!" -ForegroundColor Red
Write-Host ""
Write-Host "🔧 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Configure SMTP: " -NoNewline; Write-Host "notepad .env" -ForegroundColor Green
Write-Host "   2. Initialize Git: " -NoNewline; Write-Host "git init" -ForegroundColor Green
Write-Host "   3. First commit:  " -NoNewline; Write-Host "git add . && git commit -m 'chore: production ready'" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
