@echo off
REM =============================================================================
REM DEVELOPER ONLY — Players use Twans Ultimate Tracker.exe or TwansUltimateTrackerSetup.exe
REM =============================================================================
title Twans Ultimate Tracker - Rocket League
cd /d "%~dp0"

REM === Your RL name (or set via tracker setup - Apply & Go) ===
set RLNAME=twan

REM === Local tracker URL on this PC ===
set TRACKER_URL=http://localhost:8080

echo.
echo  =================================
echo   Twans Ultimate Tracker
echo   Rocket League Mode
echo  =================================
echo.
echo  Starting tracker on http://localhost:8080 ...
echo.
echo  IMPORTANT: Use http://localhost:8080 from THIS launcher.
echo  Player guide: docs\USER-SETUP.md
echo.
echo  Port 8080 busy- Close VS Code Live Server / Live Preview
echo  and any old tracker windows - then run this .bat again.
echo  (No admin needed - see docs\USER-SETUP.md)
echo.

netstat -ano | findstr :8080 >nul 2>&1
if not errorlevel 1 (
  echo  WARNING: Something is already using port 8080.
  echo  If another Rocket League / Valorant Tracker window is open,
  echo  use http://localhost:8080 in that session - you may not need a second start.
  echo  Otherwise close Live Server or the other app BEFORE the tracker starts.
  echo  Help: docs\USER-SETUP.md  (section: port 8080 blocked)
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
  echo.
  echo  ERROR: Missing scripts\start-grind.mjs
  echo  Run this from the full tracker folder ^(index.html, css\, js\, scripts\^).
  echo  See docs\USER-SETUP.md
  echo.
  pause
  exit /b 1
)

if not exist "scripts\rl-bridge.mjs" (
  echo ERROR: Missing scripts\rl-bridge.mjs - download the full tracker folder.
  pause
  exit /b 1
)

if not exist "tracker\index.html" (
  echo ERROR: Missing tracker\index.html - download the full tracker folder.
  pause
  exit /b 1
)

set RL_PLAYER_NAME=%RLNAME%
set TRACKER_URL=%TRACKER_URL%
node scripts/start-grind.mjs "%RLNAME%" --launch-rl

if errorlevel 1 (
  echo.
  echo  If port 8080 is blocked, close Live Server manually ^(no admin needed^).
  echo  Full steps: docs\USER-SETUP.md
  echo.
  pause
)

