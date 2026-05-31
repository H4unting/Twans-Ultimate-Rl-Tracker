@echo off
title Twans Ultimate Tracker
cd /d "%~dp0"

REM === Your RL name is set from the tracker setup page (Apply & Go) ===
REM Leave blank here unless you want a fallback before first setup
set RLNAME=twan

REM === Your tracker bookmark (GitHub Pages) — one URL for everything ===
REM Use http://localhost:8080 on your gaming PC (auto-log needs this — not GitHub Pages)
set TRACKER_URL=http://localhost:8080

echo.
echo  ============================================
echo   Twans Ultimate Tracker - Starting...
echo   Name: %RLNAME%
echo   Site: %TRACKER_URL%
echo.
echo   Or use Twans Auto-Log.exe (tray app, no black window).
echo   Build once with launcher\build-bridge.bat
echo  ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "scripts\start-grind.mjs" (
  echo.
  echo  ERROR: Missing scripts\start-grind.mjs
  echo.
  echo  start-grind.bat must live in the FULL tracker folder, not alone.
  echo  You need this layout in the same folder:
  echo    start-grind.bat
  echo    index.html
  echo    css\
  echo    js\
  echo    scripts\start-grind.mjs
  echo    scripts\rl-bridge.mjs
  echo.
  echo  Download the whole repo from GitHub ^(Code - Download ZIP^)
  echo  and unzip it. Then run start-grind.bat from inside that folder.
  echo.
  pause
  exit /b 1
)

if not exist "scripts\rl-bridge.mjs" (
  echo ERROR: Missing scripts\rl-bridge.mjs - download the full tracker folder.
  pause
  exit /b 1
)

if not exist "index.html" (
  echo ERROR: Missing index.html - download the full tracker folder.
  pause
  exit /b 1
)

set RL_PLAYER_NAME=%RLNAME%
set TRACKER_URL=%TRACKER_URL%
node scripts/start-grind.mjs "%RLNAME%"

if errorlevel 1 pause
