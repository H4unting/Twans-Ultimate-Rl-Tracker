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
echo.
echo  FIRST TIME setup (in the tab this opens):
echo    1. Auto-Log Setup - add Riot ID (Name#TAG)
echo    2. Get free Henrik key at api.henrikdev.xyz/dashboard
echo    3. Paste key, click Apply ^& Go
echo    4. Turn Auto-log ON in the dock
echo.
echo  IMPORTANT: Use http://localhost:8080 from THIS launcher.
echo  Close Live Server / other apps on port 8080 first.
echo  Port blocked? Run Kill-Port-8080.bat, then start this .bat again.
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
