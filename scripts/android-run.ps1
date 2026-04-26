# Stabilize Android tooling for React Native CLI on Windows.
# - Ensures ANDROID_HOME / ANDROID_SDK_ROOT
# - Prepends platform-tools + emulator to PATH (fixes: adb found but emulator -list-avds empty in same shell)
# - Pins REACT_NATIVE_ADB_PATH to the same adb.exe used by the SDK

$ErrorActionPreference = "Stop"

function Get-AdbFromPath {
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) {
    return (Resolve-Path $cmd.Source).Path
  }
  $where = & where.exe adb 2>$null
  if ($where -and $where.Length -gt 0) {
    return (Resolve-Path $where[0]).Path
  }
  return $null
}

# Prefer an explicit SDK root only if it really contains platform-tools\adb.exe
$defaultSdk = "$env:LOCALAPPDATA\Android\Sdk"
$candidateRoots = @(
  $env:ANDROID_HOME
  $env:ANDROID_SDK_ROOT
  $defaultSdk
) | Where-Object { $_ -and (Test-Path $_) }

$selectedRoot = $null
foreach ($root in $candidateRoots) {
  $adb = Join-Path $root "platform-tools\adb.exe"
  if (Test-Path $adb) { $selectedRoot = $root; break }
}

# If ANDROID_HOME points to a bad/moved SDK, detect adb from PATH and infer SDK root
if (-not $selectedRoot) {
  $adbFromPath = Get-AdbFromPath
  if ($adbFromPath) {
    $inferred = Split-Path (Split-Path $adbFromPath)
    if (Test-Path (Join-Path $inferred "platform-tools\adb.exe")) {
      $selectedRoot = $inferred
      Write-Host "Note: ANDROID_HOME was invalid for adb; inferred SDK: $selectedRoot" -ForegroundColor Yellow
    }
  }
}

if (-not $selectedRoot) {
  Write-Host "ERROR: Could not locate Android SDK. Checked:" -ForegroundColor Red
  $candidateRoots | ForEach-Object { Write-Host " - $_" -ForegroundColor DarkGray }
  Write-Host "Fix: set ANDROID_HOME to your real SDK root (folder that contains platform-tools\adb.exe), or add platform-tools to PATH." -ForegroundColor Yellow
  exit 1
}

$env:ANDROID_HOME = $selectedRoot
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

$pt = Join-Path $env:ANDROID_HOME "platform-tools"
$em = Join-Path $env:ANDROID_HOME "emulator"
$adbExe = Join-Path $pt "adb.exe"

# Put SDK tools first on PATH for this process
$env:Path = "$pt;$em;$env:Path"
$env:REACT_NATIVE_ADB_PATH = $adbExe

# If user didn't pass an explicit --port, default to 8082 (common when Metro is already on 8082)
$hasPort = $args | Where-Object { $_ -match '^--port$' -or $_ -match '^--port=' }
if (-not $hasPort) {
  $forwarded = @('--port', '8082') + $args
} else {
  $forwarded = $args
}

Write-Host "Using ANDROID_HOME=$($env:ANDROID_HOME)" -ForegroundColor Cyan
Write-Host "Using ADB=$($env:REACT_NATIVE_ADB_PATH)" -ForegroundColor Cyan
if (Get-Command emulator -ErrorAction SilentlyContinue) {
  & emulator -list-avds | Out-String | ForEach-Object { if ($_.Trim().Length -gt 0) { Write-Host "AVDs:`n$($_)" -ForegroundColor DarkGray } }
}

& npx react-native run-android @forwarded
exit $LASTEXITCODE
