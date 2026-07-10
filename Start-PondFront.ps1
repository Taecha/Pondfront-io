$ErrorActionPreference = "Stop"

function Write-PondFront {
  param([string]$Message, [string]$Color = "Cyan")
  Write-Host "[PondFront] $Message" -ForegroundColor $Color
}

function Wait-On-Error {
  param([string]$Message)
  Write-Host ""
  Write-PondFront $Message "Red"
  Write-Host "Press Enter to close this window."
  [void][System.Console]::ReadLine()
}

function Test-PondFrontHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing "http://localhost:5173/health" -TimeoutSec 2
    return ($response.Content -match '"ok"\s*:\s*true')
  } catch {
    return $false
  }
}

function Stop-OldPondFrontServer {
  try {
    $listener = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $listener) { return $true }

    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
    $commandLine = [string]$processInfo.CommandLine
    $processName = [string]$processInfo.Name

    if ($commandLine -match "server\.js" -or $processName -match "node") {
      Write-PondFront "Port 5173 is busy, closing the old PondFront server..."
      Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 700
      return $true
    }

    Write-PondFront "Port 5173 is being used by another app: $processName" "Yellow"
    Write-PondFront "Close that app, then run Open PondFront.bat again." "Yellow"
    return $false
  } catch {
    Write-PondFront "Could not check port 5173: $($_.Exception.Message)" "Yellow"
    return $true
  }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = $scriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $projectDir "server.js"))) {
  $nestedProject = Join-Path $scriptRoot "pondfront"
  if (Test-Path -LiteralPath (Join-Path $nestedProject "server.js")) {
    $projectDir = $nestedProject
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $projectDir "server.js"))) {
  Wait-On-Error "I could not find server.js. Keep this launcher inside the PondFront project folder."
  exit 1
}

$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue

if (Test-Path -LiteralPath $bundledNode) {
  $nodeExe = $bundledNode
} elseif ($nodeCommand) {
  $nodeExe = $nodeCommand.Source
} else {
  Write-PondFront "Node.js was not found on this computer." "Red"
  Write-PondFront "Install Node.js LTS from https://nodejs.org, then run Open PondFront.bat again." "Yellow"
  Start-Process "https://nodejs.org/"
  Wait-On-Error "Missing Node.js."
  exit 1
}

Write-PondFront "Project folder: $projectDir"

if (-not (Test-Path -LiteralPath (Join-Path $projectDir "node_modules"))) {
  Write-PondFront "node_modules is missing. Trying to install packages..."
  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $npmCommand) {
    Wait-On-Error "Packages are missing and npm was not found. Install Node.js LTS, then run this again."
    exit 1
  }

  Push-Location $projectDir
  try {
    & $npmCommand.Source install
  } finally {
    Pop-Location
  }
}

if (Test-PondFrontHealth) {
  Write-PondFront "PondFront is already running. Opening the game..."
  Start-Process "http://localhost:5173/"
  Start-Sleep -Seconds 2
  exit 0
}

if (-not (Stop-OldPondFrontServer)) {
  Wait-On-Error "Could not start because port 5173 is blocked."
  exit 1
}

$logDir = Join-Path $projectDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outLog = Join-Path $logDir "pondfront-$stamp.out.log"
$errLog = Join-Path $logDir "pondfront-$stamp.err.log"
$pidFile = Join-Path $projectDir ".pondfront-server.pid"

Write-PondFront "Starting PondFront server..."
$serverProcess = Start-Process -FilePath $nodeExe -ArgumentList @("server.js") -WorkingDirectory $projectDir -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
Set-Content -LiteralPath $pidFile -Value $serverProcess.Id

$started = $false
for ($i = 0; $i -lt 16; $i += 1) {
  Start-Sleep -Milliseconds 500
  if (Test-PondFrontHealth) {
    $started = $true
    break
  }
}

if ($started) {
  Write-PondFront "Done. Opening PondFront.io..."
  Start-Process "http://localhost:5173/"
  Start-Sleep -Seconds 2
  exit 0
}

Write-Host ""
Write-PondFront "The server did not start. Recent error log:" "Red"
if (Test-Path -LiteralPath $errLog) {
  Get-Content -LiteralPath $errLog -Tail 20
}
Write-Host ""
Write-PondFront "Full logs are in: $logDir" "Yellow"
Wait-On-Error "PondFront could not start."
exit 1
