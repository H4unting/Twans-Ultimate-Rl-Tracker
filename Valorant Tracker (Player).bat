@echo off
REM =============================================================================
REM DEVELOPER ONLY — Players use Twans Ultimate Tracker.exe or TwansUltimateTrackerSetup.exe
REM =============================================================================
title Twans Ultimate Tracker — Valorant (Player)
cd /d "%~dp0"

set TRACKER_URL=http://localhost:8080

echo.
echo  =================================
echo   Twans Ultimate Tracker
echo   Valorant Mode (Player)
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
echo  Player guide: docs\USER-SETUP.md
echo.
echo  Port 8080 busy? Close VS Code Live Server / Live Preview
echo  and any old tracker windows — then run this .bat again.
echo  (No admin needed — see docs\USER-SETUP.md)
echo.

netstat -ano | findstr :8080 >nul 2>&1
if not errorlevel 1 (
  echo  WARNING: Something is already using port 8080.
  echo  Close Live Server or stop the other app BEFORE the tracker starts.
  echo  Help: docs\USER-SETUP.md  ^(section: port 8080 blocked^)
  echo.
  pause
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  echo See docs\USER-SETUP.md for the full player setup.
  pause
  exit /b 1
)

if not exist "scripts\start-grind.mjs" (
  echo ERROR: Missing scripts\start-grind.mjs — download the FULL repo ZIP,
  echo not just this .bat file. See docs\USER-SETUP.md
  pause
  exit /b 1
)

if not exist "tracker\index.html" (
  echo ERROR: Missing tracker\index.html — download the full tracker folder.
  pause
  exit /b 1
)

set TRACKER_URL=%TRACKER_URL%
node scripts/start-grind.mjs --val-only --launch-val --no-browser

if errorlevel 1 (
  echo.
  echo  If port 8080 is blocked, close Live Server manually ^(no admin needed^).
  echo  Full steps: docs\USER-SETUP.md
  echo.
  pause
)
