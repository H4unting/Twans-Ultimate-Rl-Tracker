@echo off
REM =============================================================================
REM DEVELOPER ONLY - Build script for developers packaging the desktop app
REM =============================================================================
title Build Twans Ultimate Tracker
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org then run this again.
  pause
  exit /b 1
)

echo.
echo  Building Twans Ultimate Tracker desktop app...
echo  Close Twans Ultimate Tracker before building if a previous build failed
echo  with "The process cannot access the file" on app.asar.
echo.

if not exist "node_modules" (
  echo  Installing dependencies...
  call npm install
  if errorlevel 1 goto fail
)

call npm run build
if errorlevel 1 goto fail

echo.
echo  Done! Run this from your tracker folder:
echo    Twans Ultimate Tracker.exe
echo.
echo  Or double-click the copy in the tracker root.
echo.
pause
exit /b 0

:fail
echo.
echo  Build failed. Close Twans Ultimate Tracker and any copy running from
echo  tools\launcher\dist, then run this script again.
echo.
pause
exit /b 1

