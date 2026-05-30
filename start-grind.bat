@echo off
title RL Grind Tracker
cd /d "%~dp0"

REM === EDIT THIS to your exact Rocket League display name ===
set RLNAME=Twan

echo.
echo  ============================================
echo   RL Grind Tracker - Starting...
echo   Name: %RLNAME%
echo.
echo   A black window will stay open - DO NOT close
echo   it while you play. Your browser opens auto.
echo  ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

node scripts/start-grind.mjs "%RLNAME%"

if errorlevel 1 pause
