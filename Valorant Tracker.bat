@echo off
title Twans Ultimate Tracker — Valorant
cd /d "%~dp0"

set TRACKER_URL=http://localhost:8080

echo.
echo  =================================
echo   Twans Ultimate Tracker
echo   Valorant Mode
echo  =================================
echo.
echo  Starting tracker on http://localhost:8080 ...
echo  Use THAT tab for auto-log (not Live Server / GitHub Pages).
echo.
echo  Overwolf extension folder:
echo    %~dp0integrations\overwolf
echo  Double-click OPEN-THIS-FOLDER.bat there when loading in Overwolf.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "scripts\start-grind.mjs" (
  echo ERROR: Missing scripts\start-grind.mjs — run from the full tracker folder.
  pause
  exit /b 1
)

if not exist "index.html" (
  echo ERROR: Missing index.html — run from the full tracker folder.
  pause
  exit /b 1
)

set TRACKER_URL=%TRACKER_URL%
node scripts/start-grind.mjs --val-only --launch-val --no-browser

if errorlevel 1 pause
