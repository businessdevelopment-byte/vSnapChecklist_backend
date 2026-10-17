#requires -Version 5
<#
  Auto-deploy for the vSnap Checklist Backend (Windows service "BotivateAPI").
  Invoked by deploy/webhook-listener.mjs on a push to origin/main, but is safe
  to run by hand too:  powershell -ExecutionPolicy Bypass -File deploy\auto-deploy.ps1

  Sequence mirrors DEPLOYMENT.md:
    git fetch -> merge --ff-only -> npm ci -> prisma generate -> migrate deploy -> build -> Restart-Service
  Logs to C:\Tools\vsnap-deploy\deploy.log and guards against overlapping runs.
#>
[CmdletBinding()]
param(
  [string]$RepoPath    = 'C:\inetpub\wwwroot\botivate_new_api\vSnapChecklist_backend',
  [string]$ServiceName = 'BotivateAPI',
  [string]$LogDir      = 'C:\Tools\vsnap-deploy'
)

# Native tools (git/npm) write progress to stderr; with EAP=Stop that stderr
# becomes a terminating error and aborts the deploy. Keep Continue and gate on
# $LASTEXITCODE explicitly; critical cmdlets use -ErrorAction Stop individually.
$ErrorActionPreference = 'Continue'
if (!(Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$log  = Join-Path $LogDir 'deploy.log'
$lock = Join-Path $LogDir 'deploy.lock'

function Log($msg) {
  $line = ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg)
  Add-Content -Path $log -Value $line
  Write-Output $line
}

# --- overlap guard -----------------------------------------------------------
if (Test-Path $lock) {
  $age = (Get-Date) - (Get-Item $lock).LastWriteTime
  if ($age.TotalMinutes -lt 30) { Log "Deploy already running (lock age $([int]$age.TotalSeconds)s); exiting."; exit 0 }
  Log "Stale lock ($([int]$age.TotalMinutes)m old); overriding."
}
Set-Content -Path $lock -Value (Get-Date -Format o)

try {
  Set-Location $RepoPath -ErrorAction Stop
  Log '=== Deploy started ==='
  $before = (git rev-parse --short HEAD)
  Log "Before: $before"

  git fetch origin main 2>&1 | ForEach-Object { Log "git-fetch: $_" }
  if ($LASTEXITCODE -ne 0) { throw "git fetch failed ($LASTEXITCODE)" }
  git merge --ff-only origin/main 2>&1 | ForEach-Object { Log "git-merge: $_" }
  if ($LASTEXITCODE -ne 0) { throw "git merge --ff-only failed ($LASTEXITCODE)" }

  $after = (git rev-parse --short HEAD)
  Log "After:  $after"
  if ($before -eq $after) { Log 'No new commits; nothing to deploy.'; Log '=== Deploy skipped ==='; exit 0 }

  # Use the .cmd shims so native exit codes populate $LASTEXITCODE reliably.
  Log 'npm ci...'
  & npm.cmd ci 2>&1 | Select-Object -Last 3 | ForEach-Object { Log "npm: $_" }
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed ($LASTEXITCODE)" }

  Log 'prisma generate...'
  & npx.cmd prisma generate 2>&1 | Select-Object -Last 2 | ForEach-Object { Log "prisma-gen: $_" }
  if ($LASTEXITCODE -ne 0) { throw "prisma generate failed ($LASTEXITCODE)" }

  Log 'prisma migrate deploy...'
  & npx.cmd prisma migrate deploy 2>&1 | Select-Object -Last 6 | ForEach-Object { Log "migrate: $_" }
  if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed ($LASTEXITCODE)" }

  Log 'npm run build...'
  & npm.cmd run build 2>&1 | Select-Object -Last 3 | ForEach-Object { Log "build: $_" }
  if ($LASTEXITCODE -ne 0) { throw "build failed ($LASTEXITCODE)" }

  Log "Restarting service $ServiceName..."
  Restart-Service $ServiceName -ErrorAction Stop
  Start-Sleep -Seconds 4
  Log ("Service status: " + (Get-Service $ServiceName).Status)

  Log "=== Deploy finished OK ($before -> $after) ==="
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  exit 1
}
finally {
  Remove-Item $lock -ErrorAction SilentlyContinue
}
