@echo off
title Twans Ultimate Tracker — Rocket League
cd /d "%~dp0"

REM === Your RL name (or set via tracker setup — Apply & Go) ===
set RLNAME=twan

REM === Local tracker URL on this PC ===
set TRACKER_URL=http://localhost:8080

echo.
echo  =================================
echo   Twans Ultimate Tracker
echo   Rocket League Mode
echo  =================================
echo.
echo  Starting tracker...

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "scripts\start-grind.mjs" (
  echo.
  echo  ERROR: Missing scripts\start-grind.mjs
  echo  Run this from the full tracker folder ^(index.html, css\, js\, scripts\^).
  echo.
  pause
  exit /b 1
)

if not exist "scripts\rl-bridge.mjs" (
  echo ERROR: Missing scripts\rl-bridge.mjs — download the full tracker folder.
  pause
  exit /b 1
)

if not exist "index.html" (
  echo ERROR: Missing index.html — download the full tracker folder.
  pause
  exit /b 1
)

set RL_PLAYER_NAME=%RLNAME%
set TRACKER_URL=%TRACKER_URL%
node scripts/start-grind.mjs "%RLNAME%" --launch-rl

if errorlevel 1 pause
