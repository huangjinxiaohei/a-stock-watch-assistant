$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Join-Path $Root "stock-api"
$WebDir = Join-Path $Root "stock-web"
$ApiPython = Join-Path $ApiDir ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $ApiDir)) {
  throw "stock-api directory not found: $ApiDir"
}
if (-not (Test-Path -LiteralPath $WebDir)) {
  throw "stock-web directory not found: $WebDir"
}
if (-not (Test-Path -LiteralPath $ApiPython)) {
  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if (-not $pythonCommand) {
    throw "Python executable not found. Expected $ApiPython or python on PATH."
  }
  $ApiPython = $pythonCommand.Source
}

$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$npxCommand = Get-Command npx -ErrorAction SilentlyContinue
if (-not $pnpmCommand -and -not $npxCommand) {
  throw "Neither pnpm nor npx was found on PATH. Install Node.js tooling before starting stock-web."
}

Write-Host "Starting stock-api: http://127.0.0.1:8787/"
Write-Host "Starting stock-web: http://127.0.0.1:5173/"
Write-Host "Press Ctrl+C to stop both services."

$apiJob = Start-Job -Name "stock-api" -ScriptBlock {
  param($ApiDir, $ApiPython)
  Set-Location -LiteralPath $ApiDir
  & $ApiPython -m uvicorn app.main:app --host 127.0.0.1 --port 8787
} -ArgumentList $ApiDir, $ApiPython

$webJob = Start-Job -Name "stock-web" -ScriptBlock {
  param($WebDir, $PnpmPath, $NpxPath)
  Set-Location -LiteralPath $WebDir
  if ($PnpmPath) {
    & $PnpmPath dev --host 127.0.0.1 --port 5173
  } else {
    & $NpxPath vite --host 127.0.0.1 --port 5173
  }
} -ArgumentList $WebDir, $pnpmCommand.Source, $npxCommand.Source

$jobs = @($apiJob, $webJob)
try {
  while ($true) {
    foreach ($job in $jobs) {
      Receive-Job -Job $job
      if ($job.State -in @("Failed", "Stopped", "Completed")) {
        throw "$($job.Name) exited with state $($job.State)."
      }
    }
    Start-Sleep -Seconds 1
  }
} finally {
  foreach ($job in $jobs) {
    Stop-Job -Job $job -ErrorAction SilentlyContinue
    Receive-Job -Job $job -ErrorAction SilentlyContinue
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
  }
}
