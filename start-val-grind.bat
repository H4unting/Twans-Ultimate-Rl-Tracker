@echo off
title Twans Ultimate Tracker (Valorant only)
cd /d "%~dp0"

set TRACKER_URL=http://localhost:8080

echo.
echo  ============================================
echo   Twans Ultimate Tracker - Valorant only
echo.
echo   STEP 1: Keep this window open
echo   STEP 2: Launch Val (or you already did - fine)
echo   STEP 3: Browser opens in ~15 sec OR go to:
echo           http://localhost:8080
echo.
echo   Launching Val alone does NOT arm auto-log.
echo   After a match ENDS, wait 1-3 min for it to log.
echo  ============================================
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

set TRACKER_URL=%TRACKER_URL%
node scripts/start-grind.mjs --val-only --no-browser

if errorlevel 1 pause
