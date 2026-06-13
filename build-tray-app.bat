@echo off
REM =============================================================================
REM DEVELOPER ONLY - Build script for developers packaging the desktop app
REM =============================================================================
title Build Twans Ultimate Tracker
cd /d "%~dp0tools\launcher"
echo.
echo  Builds always update the single app at repo root:
echo    Twans Ultimate Tracker.exe
echo.
echo  The build stops a running copy automatically. If copy fails, close the app
echo  and run this script again (no separate "-new" exe is created by default).
echo.
call build-bridge.bat
