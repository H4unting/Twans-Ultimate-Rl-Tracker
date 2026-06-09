@echo off
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
echo  Build failed.
pause
exit /b 1
