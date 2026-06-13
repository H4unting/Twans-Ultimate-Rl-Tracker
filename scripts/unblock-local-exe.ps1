# Unblock locally built Twans Ultimate Tracker portable EXEs (Mark of the Web).
# Does NOT bypass Smart App Control — turn SAC Off in Windows Security or use npm start for dev.
# Run manually from repo root:  .\scripts\unblock-local-exe.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

$candidates = @(
    Join-Path $repoRoot 'Twans Ultimate Tracker.exe'
    Join-Path $repoRoot 'Twans Ultimate Tracker-new.exe'
    Join-Path $repoRoot 'tools\launcher\dist\Twans Ultimate Tracker.exe'
    Join-Path $repoRoot 'tools\launcher\dist\win-unpacked\Twans Ultimate Tracker.exe'
)

$unblocked = 0
foreach ($path in $candidates) {
    if (-not (Test-Path -LiteralPath $path)) {
        continue
    }
    Unblock-File -LiteralPath $path
    Write-Host "Unblocked: $path"
    $unblocked++
}

if ($unblocked -eq 0) {
    Write-Host 'No portable EXE found. Build first: cd tools\launcher && npm run build'
    exit 1
}

Write-Host ''
Write-Host 'Done. If Smart App Control still blocks the app, use npm start for dev or turn SAC Off in Windows Security.'
Write-Host 'See docs/DESKTOP-INSTALL.md'
