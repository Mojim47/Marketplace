param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$preserveFiles = @(
  ".env",
  ".env.local",
  ".env.production"
)

$backupRoot = Join-Path $env:TEMP ("nextgen-cleanup-env-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $backupRoot | Out-Null

$saved = @()
foreach ($file in $preserveFiles) {
  if (Test-Path $file) {
    Copy-Item -Path $file -Destination (Join-Path $backupRoot $file) -Force
    $saved += $file
  }
}

Write-Host "Saved env backups:" ($saved -join ", ")
if ($DryRun) {
  git clean -ndX
  Write-Host "Dry-run only. No files were removed."
  exit 0
}

git clean -fdX

foreach ($file in $saved) {
  $src = Join-Path $backupRoot $file
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination $file -Force
  }
}

Write-Host "Cleanup complete."
if ($saved.Count -gt 0) {
  Write-Host "Restored env files:" ($saved -join ", ")
}
