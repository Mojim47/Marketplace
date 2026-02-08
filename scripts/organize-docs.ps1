# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Documentation Organizer (PowerShell)
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Clean up root directory by organizing documentation files
# Safety: Checks file existence before moving, preserves critical files
# Usage: .\scripts\organize-docs.ps1
# ═══════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

# ───────────────────────────────────────────────────────────────────────────
# Helper Functions
# ───────────────────────────────────────────────────────────────────────────

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# ───────────────────────────────────────────────────────────────────────────
# Validation
# ───────────────────────────────────────────────────────────────────────────

if (-not (Test-Path "package.json")) {
    Write-Error "package.json not found. Please run this script from the project root."
    exit 1
}

Write-Info "Starting documentation organization..."

# ───────────────────────────────────────────────────────────────────────────
# Create Directory Structure
# ───────────────────────────────────────────────────────────────────────────

Write-Info "Creating documentation directories..."

$directories = @(
    "docs\01-architecture",
    "docs\02-deployment",
    "docs\03-reports",
    "docs\99-archive"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

Write-Success "Directory structure created"

# ───────────────────────────────────────────────────────────────────────────
# Move Files - Helper Function
# ───────────────────────────────────────────────────────────────────────────

function Move-DocumentationFile {
    param(
        [string]$Source,
        [string]$Destination
    )
    
    if (Test-Path $Source) {
        Move-Item -Path $Source -Destination $Destination -Force
        Write-Success "Moved: $Source → $Destination"
        return $true
    } else {
        Write-Warning "File not found: $Source (skipping)"
        return $false
    }
}

# ───────────────────────────────────────────────────────────────────────────
# Move Reports
# ───────────────────────────────────────────────────────────────────────────

Write-Info "Moving report files..."

$reportFiles = @(
    "ADMIN_PANEL_IMPLEMENTATION_REPORT.md",
    "PRODUCTION_READINESS_CERTIFICATE.md",
    "FINAL_PRODUCTION_AUDIT.md",
    "COMPLETION_REPORT.md",
    "COMPREHENSIVE_AUDIT_GOLDEN7.md",
    "EXECUTIVE_SUMMARY.md",
    "EXECUTIVE_SUMMARY_GOLDEN7.md",
    "EXECUTIVE_SUMMARY_PHASE_3.md",
    "FINAL_PRODUCTION_READINESS_REPORT.md",
    "FINAL_READY_SUMMARY_PERSIAN.md",
    "ENTERPRISE_TESTING_SUMMARY.md",
    "DEVOPS_DELIVERY_SUMMARY.md",
    "DEVOPS_PHASE_4_COMPLETE.md",
    "DEVOPS_PHASE_COMPLETE.md",
    "COMPLETE_DELIVERY_SUMMARY.md"
)

foreach ($file in $reportFiles) {
    Move-DocumentationFile -Source $file -Destination "docs\03-reports\"
}

# ───────────────────────────────────────────────────────────────────────────
# Move Architecture Files
# ───────────────────────────────────────────────────────────────────────────

Write-Info "Moving architecture files..."

$archFiles = @(
    "ARCHITECTURE_COMPLETE.md",
    "ARCHITECTURE_COMPLETION_FINAL.md",
    "ARCHITECTURE_IMPLEMENTATION_FINAL_REPORT.md",
    "ARCHITECTURE_INDEX.md",
    "ARCHITECTURE_QUICK_REFERENCE.md",
    "ARCHITECTURE_SUMMARY.md",
    "ARCHITECTURE_VISUAL.md",
    "BACKEND_ARCHITECTURE.md",
    "DESIGN_SYSTEM_AND_ADMIN_ARCHITECTURE.md",
    "FULL_STACK_ANALYSIS.md",
    "FRONTEND_AUDIT.md",
    "COMPREHENSIVE_MONITORING_GUIDE.md",
    "COMPREHENSIVE_TESTING_GUIDE.md"
)

foreach ($file in $archFiles) {
    Move-DocumentationFile -Source $file -Destination "docs\01-architecture\"
}

# ───────────────────────────────────────────────────────────────────────────
# Move Deployment Files
# ───────────────────────────────────────────────────────────────────────────

Write-Info "Moving deployment files..."

$deployFiles = @(
    "DEPLOYMENT_CHECKLIST_PERSIAN.md",
    "DEPLOYMENT_DOCUMENTS_INDEX.md",
    "DEPLOYMENT_QUICK_REFERENCE.md",
    "DEPLOYMENT_READINESS_CERTIFICATE.md",
    "DEPLOYMENT_READY.md",
    "DEPLOYMENT_STATUS_DASHBOARD.md",
    "DEPLOYMENT_VERIFICATION_MANIFEST.md",
    "FINAL_VERIFICATION_CHECKLIST.md",
    "AZURE_LOAD_TESTING_SETUP.md",
    "DOCKER_SECURITY_GUIDE.md",
    "MONITORING_SETUP_GUIDE.md",
    "DEVOPS_DOCUMENTATION_INDEX.md"
)

foreach ($file in $deployFiles) {
    Move-DocumentationFile -Source $file -Destination "docs\02-deployment\"
}

# ───────────────────────────────────────────────────────────────────────────
# Move Archive Files
# ───────────────────────────────────────────────────────────────────────────

Write-Info "Moving files to archive..."

$archiveFiles = @(
    "PHASE_1_COMPREHENSIVE_AUDIT.md",
    "E2E_BEFORE_AND_AFTER.md",
    "E2E_COMPLETE_DOCUMENTATION.md",
    "E2E_DOCUMENTATION_INDEX.md",
    "E2E_ERRORS_FIXED_COMPLETE.md",
    "E2E_ERRORS_FIXED.md",
    "E2E_FINAL_CHECKLIST.md",
    "E2E_FINAL_FIX_REPORT.md",
    "E2E_FINAL_SUMMARY.md",
    "E2E_MASTER_SUMMARY.md",
    "E2E_QUICK_REFERENCE.md",
    "OBSERVABILITY_COMPLETE.md",
    "OBSERVABILITY_FILE_STRUCTURE.md",
    "OBSERVABILITY_IMPLEMENTATION_SUMMARY.md",
    "OBSERVABILITY_INDEX.md",
    "OBSERVABILITY_QUICK_START.md",
    "ANALYSIS_INDEX.md",
    "ANALYSIS_SUMMARY.txt",
    "DEPENDENCY_GOVERNANCE.md",
    "DETAILED_FIXES.md",
    "ENTERPRISE_SECURITY_COMPLETE.md",
    "AI_AR_ROADMAP.md",
    "DOCUMENTATION_INDEX.md"
)

foreach ($file in $archiveFiles) {
    Move-DocumentationFile -Source $file -Destination "docs\99-archive\"
}

# Move all PHASE_*.md files
Get-ChildItem -Path . -Filter "PHASE_*.md" | ForEach-Object {
    Move-DocumentationFile -Source $_.Name -Destination "docs\99-archive\"
}

# ───────────────────────────────────────────────────────────────────────────
# Create Index File
# ───────────────────────────────────────────────────────────────────────────

Write-Info "Creating index files..."

$readmeContent = @"
# 📚 NextGen Marketplace Documentation

## 📂 Structure

### 01-architecture/
System architecture, design patterns, and technical specifications.

### 02-deployment/
Deployment guides, infrastructure setup, and DevOps documentation.

### 03-reports/
Completion reports, audit results, and progress summaries.

### 99-archive/
Historical documentation and legacy files.

## 🚀 Quick Links

- [Admin Panel Implementation Report](./03-reports/ADMIN_PANEL_IMPLEMENTATION_REPORT.md)
- [Production Readiness Certificate](./03-reports/PRODUCTION_READINESS_CERTIFICATE.md)
- [Architecture Summary](./01-architecture/ARCHITECTURE_SUMMARY.md)
- [Deployment Guide](./02-deployment/DEPLOYMENT_READY.md)

## 📖 For Contributors

Please organize new documentation according to this structure:
- Architecture docs → ``01-architecture/``
- Deployment docs → ``02-deployment/``
- Reports → ``03-reports/``
- Old/outdated docs → ``99-archive/``
"@

Set-Content -Path "docs\README.md" -Value $readmeContent -Encoding UTF8
Write-Success "Created docs\README.md"

# ───────────────────────────────────────────────────────────────────────────
# Summary
# ───────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Success "Documentation organization complete!"
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Info "Directory structure:"
Get-ChildItem -Path docs -Directory | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Gray }
Write-Host ""
Write-Info "Files preserved in root:"
Get-ChildItem -Path . -Filter "*.md" | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Gray }
Write-Host ""
Write-Success "✅ Root directory is now clean and organized!"
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
