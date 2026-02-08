#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Service Health Check Script
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Verify all enterprise services are running correctly
# Usage: .\verify-services.ps1
# ═══════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  NextGen Marketplace - Service Health Check" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$allHealthy = $true

# ───────────────────────────────────────────────────────────────────────────
# Function: Test Service
# ───────────────────────────────────────────────────────────────────────────
function Test-Service {
    param(
        [string]$Name,
        [string]$Command,
        [string]$ExpectedOutput
    )
    
    Write-Host "🔍 Testing $Name... " -NoNewline
    
    try {
        $result = Invoke-Expression $Command 2>&1
        
        if ($ExpectedOutput) {
            if ($result -match $ExpectedOutput) {
                Write-Host "✅ HEALTHY" -ForegroundColor Green
                return $true
            } else {
                Write-Host "❌ FAILED" -ForegroundColor Red
                Write-Host "   Expected: $ExpectedOutput" -ForegroundColor Yellow
                Write-Host "   Got: $result" -ForegroundColor Yellow
                return $false
            }
        } else {
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ HEALTHY" -ForegroundColor Green
                return $true
            } else {
                Write-Host "❌ FAILED (Exit code: $LASTEXITCODE)" -ForegroundColor Red
                return $false
            }
        }
    }
    catch {
        Write-Host "❌ ERROR" -ForegroundColor Red
        Write-Host "   $($_.Exception.Message)" -ForegroundColor Yellow
        return $false
    }
}

# ───────────────────────────────────────────────────────────────────────────
# 1. Docker Services
# ───────────────────────────────────────────────────────────────────────────
Write-Host "📦 Checking Docker Services..." -ForegroundColor Yellow
Write-Host ""

$services = @(
    "nextgen-postgres-prod",
    "nextgen-redis-prod",
    "nextgen-minio-prod",
    "nextgen-meilisearch-prod",
    "nextgen-worker-prod",
    "nextgen-backup-service"
)

foreach ($service in $services) {
    $status = docker inspect -f '{{.State.Status}}' $service 2>&1
    $health = docker inspect -f '{{.State.Health.Status}}' $service 2>&1
    
    Write-Host "  $service : " -NoNewline
    
    if ($status -eq "running") {
        if ($health -like "*healthy*" -or $health -like "*no healthcheck*") {
            Write-Host "✅ Running" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Running (unhealthy)" -ForegroundColor Yellow
            $allHealthy = $false
        }
    } else {
        Write-Host "❌ Not running" -ForegroundColor Red
        $allHealthy = $false
    }
}

Write-Host ""

# ───────────────────────────────────────────────────────────────────────────
# 2. PostgreSQL
# ───────────────────────────────────────────────────────────────────────────
Write-Host "🐘 PostgreSQL Database..." -ForegroundColor Yellow
$pgResult = Test-Service -Name "PostgreSQL Connection" `
    -Command "docker exec nextgen-postgres-prod pg_isready -U postgres" `
    -ExpectedOutput "accepting connections"
$allHealthy = $allHealthy -and $pgResult
Write-Host ""

# ───────────────────────────────────────────────────────────────────────────
# 3. Redis
# ───────────────────────────────────────────────────────────────────────────
Write-Host "🔴 Redis Cache..." -ForegroundColor Yellow

# Get Redis password from env or use default
$redisPass = $env:REDIS_PASSWORD
if (-not $redisPass) {
    Write-Host "⚠️  REDIS_PASSWORD not set in environment" -ForegroundColor Yellow
    $redisPass = "redis123"
}

$redisResult = Test-Service -Name "Redis Connection" `
    -Command "docker exec nextgen-redis-prod redis-cli -a $redisPass PING" `
    -ExpectedOutput "PONG"
$allHealthy = $allHealthy -and $redisResult
Write-Host ""

# ───────────────────────────────────────────────────────────────────────────
# 4. MinIO
# ───────────────────────────────────────────────────────────────────────────
Write-Host "💾 MinIO Object Storage..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9000/minio/health/live" -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "🔍 Testing MinIO Health... ✅ HEALTHY" -ForegroundColor Green
    } else {
        Write-Host "🔍 Testing MinIO Health... ❌ FAILED" -ForegroundColor Red
        $allHealthy = $false
    }
} catch {
    Write-Host "🔍 Testing MinIO Health... ❌ ERROR (Not accessible on port 9000)" -ForegroundColor Red
    $allHealthy = $false
}
Write-Host ""

# ───────────────────────────────────────────────────────────────────────────
# 5. MeiliSearch
# ───────────────────────────────────────────────────────────────────────────
Write-Host "🔍 MeiliSearch Search Engine..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:7700/health" -TimeoutSec 5
    $healthData = $response.Content | ConvertFrom-Json
    if ($healthData.status -eq "available") {
        Write-Host "🔍 Testing MeiliSearch Health... ✅ HEALTHY" -ForegroundColor Green
    } else {
        Write-Host "🔍 Testing MeiliSearch Health... ❌ FAILED" -ForegroundColor Red
        $allHealthy = $false
    }
} catch {
    Write-Host "🔍 Testing MeiliSearch Health... ❌ ERROR (Not accessible on port 7700)" -ForegroundColor Red
    $allHealthy = $false
}
Write-Host ""

# ───────────────────────────────────────────────────────────────────────────
# 6. Worker Service
# ───────────────────────────────────────────────────────────────────────────
Write-Host "⚙️  Worker Service..." -ForegroundColor Yellow
$workerLogs = docker logs --tail 20 nextgen-worker-prod 2>&1

if ($workerLogs -match "Worker service is running" -or $workerLogs -match "Worker started") {
    Write-Host "🔍 Testing Worker Service... ✅ RUNNING" -ForegroundColor Green
} else {
    Write-Host "🔍 Testing Worker Service... ⚠️  Check logs" -ForegroundColor Yellow
    Write-Host "   Run: docker logs nextgen-worker-prod" -ForegroundColor Gray
}
Write-Host ""

# ───────────────────────────────────────────────────────────────────────────
# 7. File Structure Check
# ───────────────────────────────────────────────────────────────────────────
Write-Host "📁 File Structure..." -ForegroundColor Yellow

$requiredFiles = @(
    "docker-compose.prod.yml",
    "Dockerfile.worker",
    ".env.example",
    "libs\storage\package.json",
    "libs\search\package.json",
    "libs\queue\package.json",
    "apps\worker\package.json",
    "scripts\backup-db.sh",
    "scripts\restore-db.sh"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (MISSING)" -ForegroundColor Red
        $allHealthy = $false
    }
}

Write-Host ""

# ───────────────────────────────────────────────────────────────────────────
# Summary
# ───────────────────────────────────────────────────────────────────────────
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

if ($allHealthy) {
    Write-Host "✅ ALL SYSTEMS OPERATIONAL" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Your NextGen Marketplace is ready for production!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Test file upload to MinIO" -ForegroundColor White
    Write-Host "  2. Index a product in MeiliSearch" -ForegroundColor White
    Write-Host "  3. Send a test SMS/Email via worker" -ForegroundColor White
    Write-Host "  4. Test backup: npm run backup:db" -ForegroundColor White
    Write-Host ""
    exit 0
} else {
    Write-Host "⚠️  SOME ISSUES DETECTED" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "  1. Check logs: npm run docker:logs" -ForegroundColor White
    Write-Host "  2. Verify .env file is configured" -ForegroundColor White
    Write-Host "  3. Restart services: npm run docker:down:prod && npm run docker:up:prod" -ForegroundColor White
    Write-Host "  4. Check docs/DEPLOYMENT_CHECKLIST.md" -ForegroundColor White
    Write-Host ""
    exit 1
}
