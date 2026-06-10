@echo off
REM =============================================================================
REM DEVELOPER ONLY — Build script for developers packaging the desktop app
REM =============================================================================
title Build Twans Ultimate Tracker
cd /d "%~dp0tools\launcher"
call build-bridge.bat
