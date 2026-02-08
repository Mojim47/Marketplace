# ====================================================================
# NextGen Marketplace - Git Setup & Push Script
# ====================================================================
# Purpose: Initialize Git and push to new repository
# Usage: .\git-setup.ps1
# ====================================================================

Write-Host "`n🚀 Git Repository Setup & Push" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# ====================================================================
# Step 1: Get GitHub repository URL
# ====================================================================

Write-Host "📝 Enter your GitHub repository details:" -ForegroundColor Yellow
Write-Host "   Example: git@github.com:username/nextgen-market.git" -ForegroundColor Gray
Write-Host "   Or: https://github.com/username/nextgen-market.git`n" -ForegroundColor Gray

$repoUrl = Read-Host "GitHub Repository URL"

if ([string]::IsNullOrWhiteSpace($repoUrl)) {
    Write-Host "❌ Repository URL is required!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Repository URL: $repoUrl" -ForegroundColor Green

# ====================================================================
# Step 2: Check if Git is installed
# ====================================================================

Write-Host "`n🔍 Checking Git installation..." -ForegroundColor Yellow

try {
    $gitVersion = git --version
    Write-Host "✅ Git is installed: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git is not installed!" -ForegroundColor Red
    Write-Host "   Download from: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# ====================================================================
# Step 3: Initialize Git repository
# ====================================================================

Write-Host "`n📦 Initializing Git repository..." -ForegroundColor Yellow

if (Test-Path ".git") {
    Write-Host "⚠️  .git folder already exists" -ForegroundColor Yellow
    $confirm = Read-Host "Remove existing .git and reinitialize? (y/N)"
    
    if ($confirm -eq "y" -or $confirm -eq "Y") {
        Remove-Item -Path ".git" -Recurse -Force
        Write-Host "✅ Removed existing .git folder" -ForegroundColor Green
    } else {
        Write-Host "⏭️  Skipping git init" -ForegroundColor Gray
    }
}

if (-not (Test-Path ".git")) {
    git init
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
}

# ====================================================================
# Step 4: Configure Git (optional)
# ====================================================================

Write-Host "`n⚙️  Configuring Git..." -ForegroundColor Yellow

$userName = git config --global user.name 2>$null
$userEmail = git config --global user.email 2>$null

if ([string]::IsNullOrWhiteSpace($userName)) {
    $userName = Read-Host "Enter your name (for Git commits)"
    git config --global user.name "$userName"
}

if ([string]::IsNullOrWhiteSpace($userEmail)) {
    $userEmail = Read-Host "Enter your email (for Git commits)"
    git config --global user.email "$userEmail"
}

Write-Host "✅ Git user: $userName <$userEmail>" -ForegroundColor Green

# ====================================================================
# Step 5: Add all files
# ====================================================================

Write-Host "`n📂 Adding files to Git..." -ForegroundColor Yellow

git add .

$fileCount = (git diff --cached --numstat | Measure-Object).Count
Write-Host "✅ Added $fileCount files to staging" -ForegroundColor Green

# Show summary of what will be committed
Write-Host "`n📊 Files to be committed:" -ForegroundColor Cyan
git status --short | Select-Object -First 20
if ($fileCount -gt 20) {
    Write-Host "   ... and $($fileCount - 20) more files" -ForegroundColor Gray
}

# ====================================================================
# Step 6: Commit
# ====================================================================

Write-Host "`n💾 Creating initial commit..." -ForegroundColor Yellow

git commit -m "Initial commit - Fresh start from clean repository"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit created successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Commit failed" -ForegroundColor Red
    exit 1
}

# ====================================================================
# Step 7: Rename branch to 'main'
# ====================================================================

Write-Host "`n🌿 Setting default branch to 'main'..." -ForegroundColor Yellow

$currentBranch = git branch --show-current

if ($currentBranch -ne "main") {
    git branch -M main
    Write-Host "✅ Branch renamed to 'main'" -ForegroundColor Green
} else {
    Write-Host "✅ Already on 'main' branch" -ForegroundColor Green
}

# ====================================================================
# Step 8: Add remote repository
# ====================================================================

Write-Host "`n🔗 Adding remote repository..." -ForegroundColor Yellow

# Check if remote 'origin' already exists
$existingRemote = git remote get-url origin 2>$null

if ($existingRemote) {
    Write-Host "⚠️  Remote 'origin' already exists: $existingRemote" -ForegroundColor Yellow
    $confirm = Read-Host "Replace it with $repoUrl? (y/N)"
    
    if ($confirm -eq "y" -or $confirm -eq "Y") {
        git remote remove origin
        git remote add origin $repoUrl
        Write-Host "✅ Remote 'origin' updated" -ForegroundColor Green
    } else {
        Write-Host "⏭️  Keeping existing remote" -ForegroundColor Gray
    }
} else {
    git remote add origin $repoUrl
    Write-Host "✅ Remote 'origin' added" -ForegroundColor Green
}

# ====================================================================
# Step 9: Push to GitHub
# ====================================================================

Write-Host "`n🚀 Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes depending on project size..." -ForegroundColor Gray

# Check if SSH key is set up (for SSH URLs)
if ($repoUrl -match "^git@github\.com") {
    Write-Host "`n🔐 Using SSH authentication..." -ForegroundColor Cyan
    Write-Host "   Make sure your SSH key is added to GitHub!" -ForegroundColor Yellow
    Write-Host "   Guide: https://docs.github.com/en/authentication/connecting-to-github-with-ssh`n" -ForegroundColor Gray
}

try {
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Successfully pushed to GitHub!" -ForegroundColor Green
    } else {
        throw "Push failed"
    }
} catch {
    Write-Host "`n❌ Failed to push to GitHub" -ForegroundColor Red
    Write-Host "`nPossible issues:" -ForegroundColor Yellow
    Write-Host "1. SSH key not configured (for SSH URLs)" -ForegroundColor White
    Write-Host "2. No write access to repository" -ForegroundColor White
    Write-Host "3. Network connection issue" -ForegroundColor White
    Write-Host "4. Repository does not exist on GitHub`n" -ForegroundColor White
    
    Write-Host "Try manual push:" -ForegroundColor Cyan
    Write-Host "   git push -u origin main`n" -ForegroundColor Gray
    exit 1
}

# ====================================================================
# Step 10: Verify
# ====================================================================

Write-Host "`n🔍 Verifying remote repository..." -ForegroundColor Yellow

$remoteUrl = git remote get-url origin
$remoteBranch = git branch -r

Write-Host "✅ Remote URL: $remoteUrl" -ForegroundColor Green
Write-Host "✅ Remote branches: $remoteBranch" -ForegroundColor Green

# ====================================================================
# Summary
# ====================================================================

Write-Host "`n✨ Repository Setup Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan

Write-Host "`n📋 Summary:" -ForegroundColor Yellow
Write-Host "   ✅ Git initialized" -ForegroundColor White
Write-Host "   ✅ Files committed ($fileCount files)" -ForegroundColor White
Write-Host "   ✅ Pushed to: $repoUrl" -ForegroundColor White
Write-Host "   ✅ Branch: main" -ForegroundColor White

Write-Host "`n🌐 View your repository:" -ForegroundColor Cyan
if ($repoUrl -match "github\.com[:/](.+)\.git") {
    $repoPath = $matches[1]
    Write-Host "   https://github.com/$repoPath`n" -ForegroundColor White
}

Write-Host "📚 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Configure GitHub Secrets for CI/CD" -ForegroundColor White
Write-Host "   2. Set up VPS with: bash setup-vps.sh" -ForegroundColor White
Write-Host "   3. Add Deploy Key to GitHub" -ForegroundColor White
Write-Host "   4. Test auto-deployment with: git push origin main`n" -ForegroundColor White

Write-Host "📖 Full guide: See MIGRATION_GUIDE.md`n" -ForegroundColor Cyan
