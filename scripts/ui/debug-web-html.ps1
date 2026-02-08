$webOut = "scripts/ui/web-dev.out.log"
$webErr = "scripts/ui/web-dev.err.log"

$env:PORT = "3000"
$web = Start-Process -FilePath "npx" -ArgumentList "-y","pnpm@9.0.0","--filter","@nextgen/web","dev" -PassThru -RedirectStandardOutput $webOut -RedirectStandardError $webErr
$env:PORT = $null

$deadline = (Get-Date).AddSeconds(30)
$ready = $false
while ((Get-Date) -lt $deadline -and (-not $ready)) {
  try {
    $ready = (Invoke-WebRequest -UseBasicParsing http://localhost:3000/livez -TimeoutSec 2).StatusCode -eq 200
  } catch {
    $ready = $false
  }
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  Write-Host "Web dev stdout:"
  if (Test-Path $webOut) { Get-Content $webOut -Tail 120 | Write-Host }
  Write-Host "Web dev stderr:"
  if (Test-Path $webErr) { Get-Content $webErr -Tail 120 | Write-Host }
  Stop-Process -Id $web.Id -Force
  throw "Web dev did not become ready"
}

$html = Invoke-WebRequest -UseBasicParsing http://localhost:3000/ -TimeoutSec 10
Set-Content -Path "scripts/ui/web-html.txt" -Value $html.Content
Set-Content -Path "scripts/ui/web-html.status.txt" -Value $html.StatusCode

$css = Invoke-WebRequest -UseBasicParsing http://localhost:3000/_next/static/css/app/layout.css -TimeoutSec 10
Set-Content -Path "scripts/ui/web-css.status.txt" -Value $css.StatusCode
Set-Content -Path "scripts/ui/web-css.head.txt" -Value ($css.Content.Substring(0, [Math]::Min(200, $css.Content.Length)))

Stop-Process -Id $web.Id -Force
