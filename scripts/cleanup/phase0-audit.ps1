$ErrorActionPreference = "Stop"

Write-Host "== Phase 0 Audit =="

Write-Host "[1/4] Writing tracked file list..."
git ls-files > all-git-files.txt

Write-Host "[2/4] Writing workspace file list..."
rg --files -uu | ForEach-Object { $_ -replace "\\","/" } > all-files.txt

Write-Host "[3/4] Writing untracked file list (git-accurate)..."
git ls-files --others --exclude-standard > untracked-files.txt

Write-Host "[4/4] Dry-run cleanup candidates (.gitignore only)..."
git clean -ndX

Write-Host ""
Write-Host "Audit files generated:"
Write-Host " - all-git-files.txt"
Write-Host " - all-files.txt"
Write-Host " - untracked-files.txt"
