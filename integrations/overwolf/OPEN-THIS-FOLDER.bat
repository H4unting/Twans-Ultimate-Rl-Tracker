@echo off
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
echo   Settings ^> Support ^> Development options
echo   ^> Load unpacked extension
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
In Overwolf:

Settings -^> Support -^> Development options -^> Load unpacked extension

Paste path or select THIS folder (not Desktop parent):

%OW_PATH%

If you previously loaded from Desktop, remove the broken extension in Development options first, then reload.

Do NOT pick Desktop, Downloads, or the tracker repo root.
Only the integrations\overwolf folder that contains manifest.json.
'@; Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.MessageBox]::Show($msg,'Twans Val Auto-Log — select this folder',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)"
