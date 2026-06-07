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

echo.
echo  ================================================
echo   SELECT THIS FOLDER in Overwolf
echo   Settings ^> Support ^> Development options
echo   ^> Load unpacked extension
echo  ================================================
echo.
echo  %CD%
echo.
echo  Do NOT select Desktop, Downloads, or the repo root.
echo.

start "" explorer "%CD%"

powershell -NoProfile -Command ^
  "$msg = @'
In Overwolf:

Settings -^> Support -^> Development options -^> Load unpacked extension

Select THIS folder (Explorer is already open):

%CD%

Do NOT pick Desktop, Downloads, or the tracker repo root.
Only the integrations\overwolf folder that contains manifest.json.
'@; Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.MessageBox]::Show($msg,'Twans Val Auto-Log — select this folder',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)"
