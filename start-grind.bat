@echo off
REM =============================================================================
REM DEVELOPER ONLY — Players use Twans Ultimate Tracker.exe or TwansUltimateTrackerSetup.exe
REM =============================================================================
REM Legacy name — use "Rocket League Tracker.bat" instead.
cd /d "%~dp0"
call "%~dp0Rocket League Tracker.bat" %*
exit /b %ERRORLEVEL%
