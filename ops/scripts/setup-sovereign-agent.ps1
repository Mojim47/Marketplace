Param(
  [Parameter(Mandatory=$true)][string]$JsonPath,
  [Parameter(Mandatory=$true)][string]$TargetPath
)

function Get-GitCommitHash {
  try {
    $hash = git rev-parse HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $hash) { return $hash.Trim() }
    return $null
  } catch { return $null }
}

function Get-MachineId {
  try {
    $cs = Get-CimInstance -ClassName Win32_ComputerSystemProduct
    if ($cs.UUID) { return $cs.UUID }
  } catch {}
  return [System.Guid]::NewGuid().ToString()
}

if (-not (Test-Path $JsonPath)) { throw "Json file not found: $JsonPath" }

$jsonContent = Get-Content -Raw -Path $JsonPath
$createdAt = [DateTime]::UtcNow.ToString('o')
$gitHash = Get-GitCommitHash
if (-not $gitHash) { $gitHash = (Get-MachineId()) + ':' + (Get-Date -Format o) }

$payload = [PSCustomObject]@{
  createdAt = $createdAt
  gitCommitHash = $gitHash
  data = (ConvertFrom-Json $jsonContent)
}

$payloadJson = $payload | ConvertTo-Json -Depth 10
$checksumSource = $payloadJson + $createdAt + $gitHash
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$bytes = [System.Text.Encoding]::UTF8.GetBytes($checksumSource)
$hashBytes = $sha256.ComputeHash($bytes)
$checksum = -join ($hashBytes | ForEach-Object { $_.ToString('x2') })

$outObject = [PSCustomObject]@{
  meta = @{ checksum = $checksum }
  payload = $payload
}

$tempFile = [System.IO.Path]::GetTempFileName()
$outJson = $outObject | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($tempFile, $outJson, [System.Text.Encoding]::UTF8)

$maxRetries = 3
$attempt = 0
$success = $false

while (-not $success -and $attempt -lt $maxRetries) {
  $attempt++
  try {
    $fs = [System.IO.File]::Open($TargetPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    try {
      $fs.Lock(0, $fs.Length)
      $dataBytes = [System.Text.Encoding]::UTF8.GetBytes($outJson)
      $fs.SetLength(0)
      $fs.Write($dataBytes, 0, $dataBytes.Length)
      $fs.Flush()
      $success = $true
    } finally {
      $fs.Dispose()
    }
  } catch {
    Start-Sleep -Milliseconds (200 * $attempt)
  }
}

if (-not $success) {
  throw "Failed to perform atomic write after $maxRetries attempts"
}

# Verify integrity by re-reading
$written = Get-Content -Raw -Path $TargetPath
if ($written -ne $outJson) {
  throw "Integrity check failed: content mismatch"
}

Write-Output "Atomic write succeeded: $TargetPath (checksum=$checksum)"
