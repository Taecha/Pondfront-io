$ErrorActionPreference = "SilentlyContinue"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectDir ".pondfront-server.pid"

Write-Host "[PondFront] Stopping local server..." -ForegroundColor Cyan

if (Test-Path -LiteralPath $pidFile) {
  $pidValue = Get-Content -LiteralPath $pidFile | Select-Object -First 1
  if ($pidValue -match "^\d+$") {
    Stop-Process -Id ([int]$pidValue) -Force
  }
  Remove-Item -LiteralPath $pidFile -Force
}

$listener = Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -First 1
if ($listener) {
  $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
  if ([string]$processInfo.CommandLine -match "server\.js" -or [string]$processInfo.Name -match "node") {
    Stop-Process -Id $listener.OwningProcess -Force
  }
}

Write-Host "[PondFront] Done." -ForegroundColor Green
Start-Sleep -Seconds 2
