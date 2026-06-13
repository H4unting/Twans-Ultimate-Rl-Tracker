@echo off
REM =============================================================================
REM DEVELOPER ONLY - Build script for developers packaging the desktop app
REM =============================================================================
title Build Twans Ultimate Tracker
cd /d "%~dp0tools\launcher"
echo.
echo  Close Twans Ultimate Tracker before building if you see "file in use" errors.
echo  The build will try to stop Twans Ultimate Tracker.exe automatically.
echo.
call build-bridge.bat

