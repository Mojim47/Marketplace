$adminOut = "scripts/ui/admin-dev.out.log"
$adminErr = "scripts/ui/admin-dev.err.log"

$env:ADMIN_DISABLE_AUTH_MIDDLEWARE = "true"
$env:PORT = "3003"
$admin = Start-Process -FilePath "npx" -ArgumentList "-y","pnpm@9.0.0","--filter","@nextgen/admin","dev" -PassThru -RedirectStandardOutput $adminOut -RedirectStandardError $adminErr
$env:ADMIN_DISABLE_AUTH_MIDDLEWARE = $null
$env:PORT = $null

$deadline = (Get-Date).AddSeconds(30)
$ready = $false
while ((Get-Date) -lt $deadline -and (-not $ready)) {
  try {
    $ready = (Invoke-WebRequest -UseBasicParsing http://localhost:3003/livez -TimeoutSec 2).StatusCode -eq 200
  } catch {
    $ready = $false
  }
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  Write-Host "Admin dev stdout:"
  if (Test-Path $adminOut) { Get-Content $adminOut -Tail 120 | Write-Host }
  Write-Host "Admin dev stderr:"
  if (Test-Path $adminErr) { Get-Content $adminErr -Tail 120 | Write-Host }
  Stop-Process -Id $admin.Id -Force
  throw "Admin dev did not become ready"
}

node scripts/ui/debug-admin-computed.mjs

Stop-Process -Id $admin.Id -Force
