#!/usr/bin/env pwsh
<#
.SYNOPSIS
    NextGen Marketplace - Final Cleanup Script
    
.DESCRIPTION
    Cleans up the root directory by moving documentation files to docs/reports
    and removing temporary files. Prepares the project for deployment.
    
.NOTES
    Author: NextGen DevOps Team
    Date: 2025-11-25
    Purpose: Production deployment preparation
#>

# Strict mode for better error handling
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ═══════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════
$REPORTS_DIR = "docs/reports"
$ROOT_DIR = Get-Location

# Files to keep in root (whitelist)
$KEEP_IN_ROOT = @(
    "README.md",
    "LICENSE",
    ".env.example",
    "CRITICAL_FIXES_COMPLETE.md"  # Recent critical fixes documentation
)

# Patterns for markdown files to move
$MD_PATTERNS = @(
    "PHASE_*.md",
    "*_COMPLETE.md",
    "*_SUMMARY.md",
    "*_REPORT.md",
    "*_GUIDE.md",
    "*_ANALYSIS.md",
    "DEPLOYMENT_*.md",
    "MIGRATION_*.md",
    "QUICK_START.md",
    "FIXES_*.md"
)

# Patterns for temporary files to delete
$TEMP_PATTERNS = @(
    "npm-debug.log*",
    "yarn-error.log*",
    "yarn-debug.log*",
    "pnpm-debug.log*",
    ".DS_Store",
    "Thumbs.db",
    "*.tmp",
    "*.temp",
    "*.log",
    "*.tsbuildinfo"
)

# Text files to move
$TXT_PATTERNS = @(
    "*.txt"
)

# ═══════════════════════════════════════════════════════════════════════════
# Functions
# ═══════════════════════════════════════════════════════════════════════════

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Info {
    param([string]$Message)
    Write-Host "→ " -ForegroundColor Blue -NoNewline
    Write-Host $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

# ═══════════════════════════════════════════════════════════════════════════
# Main Script
# ═══════════════════════════════════════════════════════════════════════════

Write-Header "NextGen Marketplace - Final Cleanup"

# ───────────────────────────────────────────────────────────────────────────
# Step 1: Create reports directory
# ───────────────────────────────────────────────────────────────────────────
Write-Info "Creating reports directory..."

if (-not (Test-Path $REPORTS_DIR)) {
    New-Item -Path $REPORTS_DIR -ItemType Directory -Force | Out-Null
    Write-Success "Created: $REPORTS_DIR"
} else {
    Write-Success "Directory already exists: $REPORTS_DIR"
}

# ───────────────────────────────────────────────────────────────────────────
# Step 2: Move markdown files
# ───────────────────────────────────────────────────────────────────────────
Write-Header "Moving Documentation Files"

$moved_count = 0
$skipped_count = 0

foreach ($pattern in $MD_PATTERNS) {
    $files = Get-ChildItem -Path $ROOT_DIR -Filter $pattern -File -ErrorAction SilentlyContinue
    
    foreach ($file in $files) {
        # Skip if in whitelist
        if ($KEEP_IN_ROOT -contains $file.Name) {
            Write-Warning "Keeping in root: $($file.Name) (whitelisted)"
            $skipped_count++
            continue
        }
        
        $dest_path = Join-Path $REPORTS_DIR $file.Name
        
        try {
            # Check if file already exists in destination
            if (Test-Path $dest_path) {
                Write-Warning "File already exists in reports: $($file.Name)"
                # Backup existing file
                $backup_name = "$($file.BaseName)_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')$($file.Extension)"
                Move-Item -Path $dest_path -Destination (Join-Path $REPORTS_DIR $backup_name) -Force
                Write-Info "  Backed up existing file as: $backup_name"
            }
            
            Move-Item -Path $file.FullName -Destination $dest_path -Force
            Write-Success "Moved: $($file.Name) → docs/reports/"
            $moved_count++
        }
        catch {
            Write-Error-Custom "Failed to move $($file.Name): $_"
        }
    }
}

# ───────────────────────────────────────────────────────────────────────────
# Step 3: Move text files
# ───────────────────────────────────────────────────────────────────────────
Write-Header "Moving Text Files"

foreach ($pattern in $TXT_PATTERNS) {
    $files = Get-ChildItem -Path $ROOT_DIR -Filter $pattern -File -ErrorAction SilentlyContinue
    
    foreach ($file in $files) {
        $dest_path = Join-Path $REPORTS_DIR $file.Name
        
        try {
            if (Test-Path $dest_path) {
                $backup_name = "$($file.BaseName)_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')$($file.Extension)"
                Move-Item -Path $dest_path -Destination (Join-Path $REPORTS_DIR $backup_name) -Force
                Write-Info "  Backed up existing file as: $backup_name"
            }
            
            Move-Item -Path $file.FullName -Destination $dest_path -Force
            Write-Success "Moved: $($file.Name) → docs/reports/"
            $moved_count++
        }
        catch {
            Write-Error-Custom "Failed to move $($file.Name): $_"
        }
    }
}

# ───────────────────────────────────────────────────────────────────────────
# Step 4: Delete temporary files
# ───────────────────────────────────────────────────────────────────────────
Write-Header "Removing Temporary Files"

$deleted_count = 0

foreach ($pattern in $TEMP_PATTERNS) {
    $files = Get-ChildItem -Path $ROOT_DIR -Filter $pattern -File -ErrorAction SilentlyContinue
    
    foreach ($file in $files) {
        try {
            Remove-Item -Path $file.FullName -Force
            Write-Success "Deleted: $($file.Name)"
            $deleted_count++
        }
        catch {
            Write-Error-Custom "Failed to delete $($file.Name): $_"
        }
    }
}

# Clean up node_modules tsbuildinfo files
if (Test-Path "node_modules") {
    Get-ChildItem -Path "node_modules" -Filter "*.tsbuildinfo" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            Remove-Item -Path $_.FullName -Force
            $deleted_count++
        }
        catch {
            # Silently ignore errors in node_modules
        }
    }
}

# ───────────────────────────────────────────────────────────────────────────
# Step 5: Clean up dist directories (optional)
# ───────────────────────────────────────────────────────────────────────────
Write-Header "Cleaning Build Artifacts"

$dist_dirs = @(
    "dist",
    "apps/*/dist",
    "libs/*/dist"
)

$dist_cleaned = 0

foreach ($pattern in $dist_dirs) {
    $dirs = Get-ChildItem -Path $ROOT_DIR -Filter "dist" -Directory -Recurse -ErrorAction SilentlyContinue
    
    foreach ($dir in $dirs) {
        # Skip node_modules
        if ($dir.FullName -like "*node_modules*") {
            continue
        }
        
        try {
            Remove-Item -Path $dir.FullName -Recurse -Force
            Write-Success "Cleaned: $($dir.FullName -replace [regex]::Escape($ROOT_DIR), '.')"
            $dist_cleaned++
        }
        catch {
            Write-Warning "Could not clean: $($dir.FullName)"
        }
    }
}

# ───────────────────────────────────────────────────────────────────────────
# Step 6: Summary
# ───────────────────────────────────────────────────────────────────────────
Write-Header "Cleanup Summary"

Write-Host "📦 Documentation Files Moved:  " -NoNewline
Write-Host $moved_count -ForegroundColor Green

Write-Host "⏭️  Files Skipped (whitelisted): " -NoNewline
Write-Host $skipped_count -ForegroundColor Yellow

Write-Host "🗑️  Temporary Files Deleted:    " -NoNewline
Write-Host $deleted_count -ForegroundColor Green

Write-Host "🧹 Build Directories Cleaned:  " -NoNewline
Write-Host $dist_cleaned -ForegroundColor Green

Write-Host ""

# ───────────────────────────────────────────────────────────────────────────
# Step 7: Show remaining root files
# ───────────────────────────────────────────────────────────────────────────
Write-Header "Root Directory Status"

Write-Info "Files remaining in root:"
$root_files = Get-ChildItem -Path $ROOT_DIR -File | Where-Object { 
    $_.Name -notlike ".*" -and 
    $_.Name -notlike "package*.json" -and
    $_.Name -notlike "tsconfig*.json" -and
    $_.Name -notlike "*.config.*" -and
    $_.Name -notlike "*.yml" -and
    $_.Name -notlike "*.yaml" -and
    $_.Name -notlike "Dockerfile*"
}

if ($root_files.Count -eq 0) {
    Write-Success "Root directory is clean! ✨"
} else {
    foreach ($file in $root_files) {
        if ($KEEP_IN_ROOT -contains $file.Name) {
            Write-Host "  ✓ " -ForegroundColor Green -NoNewline
        } else {
            Write-Host "  • " -NoNewline
        }
        Write-Host $file.Name
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " ✅ Cleanup Complete! Project is ready for deployment." -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# Optional: Open reports directory
$open_reports = Read-Host "Open docs/reports directory? (y/N)"
if ($open_reports -eq "y" -or $open_reports -eq "Y") {
    Invoke-Item $REPORTS_DIR
}
