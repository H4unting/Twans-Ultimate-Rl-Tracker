@echo off
title Load Overwolf Extension — Twans Ultimate Tracker
cd /d "%~dp0"

if not exist "integrations\overwolf\manifest.json" (
  echo.
  echo  ERROR: integrations\overwolf\manifest.json not found.
  echo  Run this file from the tracker repo root (same folder as Valorant Tracker.bat).
  echo.
  pause
  exit /b 1
)

echo.
echo  ================================================
echo   Load Twans Val Auto-Log in Overwolf
echo  ================================================
echo.
echo  Before loading:
echo    1. Sign in to Overwolf (Appstore icon in dock)
echo    2. Development options -^> Load unpacked extension (NOT Appstore)
echo.
echo  "Unauthorized App"? Sign in first. If still blocked, Overwolf
echo  requires a developer-whitelisted account for unpacked apps —
echo  use Henrik API fallback in Auto-Log Setup instead.
echo.
echo  Remove any old broken extension in Development options
echo  if you previously picked Desktop (missing manifest.json).
echo.

call "%~dp0integrations\overwolf\OPEN-THIS-FOLDER.bat"
