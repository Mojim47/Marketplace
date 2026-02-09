$webOut = "scripts/ui/web-dev.out.log"
$webErr = "scripts/ui/web-dev.err.log"
$adminOut = "scripts/ui/admin-dev.out.log"
$adminErr = "scripts/ui/admin-dev.err.log"

$env:PORT = "3000"
$web = Start-Process -FilePath "npx" -ArgumentList "-y","pnpm@9.0.0","--filter","@nextgen/web","dev" -PassThru -RedirectStandardOutput $webOut -RedirectStandardError $webErr
$env:PORT = $null
$env:ADMIN_DISABLE_AUTH_MIDDLEWARE = "true"
$admin = Start-Process -FilePath "npx" -ArgumentList "-y","pnpm@9.0.0","--filter","@nextgen/admin","dev" -PassThru -RedirectStandardOutput $adminOut -RedirectStandardError $adminErr
$env:ADMIN_DISABLE_AUTH_MIDDLEWARE = $null

$deadline = (Get-Date).AddSeconds(150)
$webReady = $false
$adminReady = $false

while ((Get-Date) -lt $deadline -and (-not ($webReady -and $adminReady))) {
  try {
    $webReady = (Invoke-WebRequest -UseBasicParsing http://localhost:3000/livez -TimeoutSec 2).StatusCode -eq 200
  } catch {
    $webReady = $false
  }
  try {
    $adminReady = (Invoke-WebRequest -UseBasicParsing http://localhost:3003/livez -TimeoutSec 2).StatusCode -eq 200
  } catch {
    $adminReady = $false
  }
  Start-Sleep -Seconds 2
}

if (-not ($webReady -and $adminReady)) {
  Write-Host "Web dev stdout:"
  if (Test-Path $webOut) { Get-Content $webOut -Tail 80 | Write-Host }
  Write-Host "Web dev stderr:"
  if (Test-Path $webErr) { Get-Content $webErr -Tail 80 | Write-Host }
  Write-Host "Admin dev stdout:"
  if (Test-Path $adminOut) { Get-Content $adminOut -Tail 80 | Write-Host }
  Write-Host "Admin dev stderr:"
  if (Test-Path $adminErr) { Get-Content $adminErr -Tail 80 | Write-Host }
  throw "Dev servers did not become ready"
}

$env:UI_SERVER_ALREADY_RUNNING = "true"
$pwLog = "scripts/ui/playwright-baseline.log"
& npx -y pnpm@9.0.0 ui:playwright --update-snapshots *>$pwLog
$pwExit = $LASTEXITCODE
$env:UI_SERVER_ALREADY_RUNNING = $null

if ($pwExit -ne 0) {
  Write-Host "Playwright log:"
  if (Test-Path $pwLog) { Get-Content $pwLog -Tail 200 | Write-Host }
  throw "Playwright baseline update failed"
}

Stop-Process -Id $admin.Id -Force
Stop-Process -Id $web.Id -Force
