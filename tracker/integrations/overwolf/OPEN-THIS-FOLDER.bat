@echo off
REM =============================================================================
REM DEVELOPER ONLY — Optional Overwolf integration for developers
REM =============================================================================
title Twans Val Auto-Log — Overwolf folder
cd /d "%~dp0"

if not exist "manifest.json" (
  echo.
  echo  ERROR: manifest.json not found in this folder.
  echo  You opened the wrong location — use OPEN-THIS-FOLDER.bat
  echo  inside integrations\overwolf in your tracker download.
  echo.
  pause
  exit /b 1
)

set "OW_PATH=%CD%"

echo.
echo  ================================================
echo   SELECT THIS FOLDER in Overwolf
echo   Development options ^> Load unpacked extension
echo   (sign in via Appstore icon first)
echo  ================================================
echo.
echo  %OW_PATH%
echo.
echo  Path copied to clipboard.
echo  Do NOT select Desktop, Downloads, or the repo root.
echo.

powershell -NoProfile -Command "Set-Clipboard -Value '%OW_PATH%'"

start "" explorer /select,"%OW_PATH%\manifest.json"

powershell -NoProfile -Command ^
  "$msg = @'
1. Sign in to Overwolf (Appstore icon in dock).

2. Development options -^> Load unpacked extension
   (wrench -^> About, or tray -^> Settings -^> About)

3. Paste path or select THIS folder (not Desktop parent):

%OW_PATH%

Unauthorized App? Sign in first. If still blocked, use Henrik API
fallback in Auto-Log Setup (Overwolf requires developer whitelist
for unpacked extensions).

missing manifest.json? Wrong folder — remove broken entry and reload.

Do NOT pick Desktop, Downloads, or the tracker repo root.
'@; Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.MessageBox]::Show($msg,'Twans Val Auto-Log — select this folder',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)"
