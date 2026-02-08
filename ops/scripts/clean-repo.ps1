# ====================================================================
# NextGen Marketplace - Deep Repository Cleanup Script
# ====================================================================
# Purpose: Reset Git history, remove build artifacts, clean dependencies
# Usage: .\clean-repo.ps1
# WARNING: This will permanently delete .git folder and all build files
# ====================================================================

Write-Host "`n🧹 Starting Deep Repository Cleanup..." -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# Function to safely remove directories
function Remove-SafeDirectory {
    param([string]$Path, [string]$Description)
    
    if (Test-Path $Path) {
        Write-Host "🗑️  Removing $Description..." -ForegroundColor Yellow
        try {
            Remove-Item -Path $Path -Recurse -Force -ErrorAction Stop
            Write-Host "   ✅ Deleted: $Path" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Failed to delete $Path : $_" -ForegroundColor Red
        }
    } else {
        Write-Host "   ⏭️  Skipping $Description (not found)" -ForegroundColor Gray
    }
}

# Function to remove files by pattern
function Remove-FilePattern {
    param([string]$Pattern, [string]$Description)
    
    Write-Host "🔍 Searching for $Description..." -ForegroundColor Yellow
    $files = Get-ChildItem -Path . -Filter $Pattern -Recurse -File -ErrorAction SilentlyContinue
    
    if ($files.Count -gt 0) {
        Write-Host "   Found $($files.Count) file(s)" -ForegroundColor Yellow
        foreach ($file in $files) {
            try {
                Remove-Item -Path $file.FullName -Force
                Write-Host "   ✅ Deleted: $($file.FullName)" -ForegroundColor Green
            } catch {
                Write-Host "   ⚠️  Failed: $($file.FullName)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "   ✅ No $Description found" -ForegroundColor Green
    }
}

# ====================================================================
# PHASE 1: Git History Reset
# ====================================================================
Write-Host "`n📦 PHASE 1: Git History Reset" -ForegroundColor Magenta
Write-Host "----------------------------------------" -ForegroundColor Magenta

Remove-SafeDirectory -Path ".git" -Description "Git History (.git folder)"

# ====================================================================
# PHASE 2: Build Artifacts Removal
# ====================================================================
Write-Host "`n🏗️  PHASE 2: Build Artifacts Removal" -ForegroundColor Magenta
Write-Host "----------------------------------------" -ForegroundColor Magenta

$buildFolders = @(".next", "dist", "out", "build", "coverage", ".turbo")
foreach ($folder in $buildFolders) {
    Remove-SafeDirectory -Path $folder -Description "Build folder ($folder)"
}

# Remove build folders in apps/*
Write-Host "`n🔍 Cleaning build folders in apps/*..." -ForegroundColor Yellow
$appDirs = @("apps/web", "apps/admin", "apps/api", "apps/vendor-portal", "apps/worker")
foreach ($appDir in $appDirs) {
    if (Test-Path $appDir) {
        foreach ($folder in $buildFolders) {
            $fullPath = Join-Path $appDir $folder
            Remove-SafeDirectory -Path $fullPath -Description "$appDir/$folder"
        }
    }
}

# ====================================================================
# PHASE 3: Dependency Reset
# ====================================================================
Write-Host "`n📚 PHASE 3: Dependency Reset" -ForegroundColor Magenta
Write-Host "----------------------------------------" -ForegroundColor Magenta

Remove-SafeDirectory -Path "node_modules" -Description "Node Modules"

if (Test-Path "package-lock.json") {
    Write-Host "🗑️  Removing package-lock.json..." -ForegroundColor Yellow
    Remove-Item "package-lock.json" -Force
    Write-Host "   ✅ Deleted: package-lock.json" -ForegroundColor Green
}

if (Test-Path "yarn.lock") {
    Write-Host "🗑️  Removing yarn.lock..." -ForegroundColor Yellow
    Remove-Item "yarn.lock" -Force
    Write-Host "   ✅ Deleted: yarn.lock" -ForegroundColor Green
}

if (Test-Path "pnpm-lock.yaml") {
    Write-Host "🗑️  Removing pnpm-lock.yaml..." -ForegroundColor Yellow
    Remove-Item "pnpm-lock.yaml" -Force
    Write-Host "   ✅ Deleted: pnpm-lock.yaml" -ForegroundColor Green
}

# ====================================================================
# PHASE 4: Junk File Scan & Removal
# ====================================================================
Write-Host "`n🧹 PHASE 4: Junk File Scan & Removal" -ForegroundColor Magenta
Write-Host "----------------------------------------" -ForegroundColor Magenta

# Log files
$logPatterns = @("*.log", "npm-debug.log*", "yarn-debug.log*", "yarn-error.log*")
foreach ($pattern in $logPatterns) {
    Remove-FilePattern -Pattern $pattern -Description "Log files ($pattern)"
}

# System junk files
$systemJunkPatterns = @("Thumbs.db", ".DS_Store", "desktop.ini")
foreach ($pattern in $systemJunkPatterns) {
    Remove-FilePattern -Pattern $pattern -Description "System junk ($pattern)"
}

# Temporary files
Write-Host "🔍 Removing temporary files..." -ForegroundColor Yellow
$tempPatterns = @("*.tmp", "*.temp", "*.swp", "*~")
foreach ($pattern in $tempPatterns) {
    Remove-FilePattern -Pattern $pattern -Description "Temp files ($pattern)"
}

# ====================================================================
# PHASE 5: Database & Cache Cleanup
# ====================================================================
Write-Host "`n💾 PHASE 5: Database & Cache Cleanup" -ForegroundColor Magenta
Write-Host "----------------------------------------" -ForegroundColor Magenta

Remove-SafeDirectory -Path "postgres_data" -Description "PostgreSQL Data"
Remove-SafeDirectory -Path "redis_data" -Description "Redis Data"
Remove-FilePattern -Pattern "*.sqlite" -Description "SQLite databases"
Remove-FilePattern -Pattern "*.sqlite3" -Description "SQLite3 databases"

# ====================================================================
# PHASE 6: IDE & Editor Cache
# ====================================================================
Write-Host "`n💻 PHASE 6: IDE & Editor Cache" -ForegroundColor Magenta
Write-Host "----------------------------------------" -ForegroundColor Magenta

Remove-SafeDirectory -Path ".vscode/settings.json.backup*" -Description "VS Code backups"
Remove-SafeDirectory -Path ".idea" -Description "JetBrains IDE cache"

# ====================================================================
# Summary
# ====================================================================
Write-Host "`n✨ Cleanup Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✅ Repository has been cleaned and reset" -ForegroundColor Green
Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Run: git init" -ForegroundColor White
Write-Host "   2. Run: git add ." -ForegroundColor White
Write-Host "   3. Run: git commit -m 'Initial commit - Fresh start'" -ForegroundColor White
Write-Host "   4. Run: npm install (or your package manager)" -ForegroundColor White
Write-Host "`n🚀 Ready for fresh Git repository setup!`n" -ForegroundColor Cyan
