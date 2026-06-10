@echo off
REM =============================================================================
REM DEVELOPER ONLY — Players use Twans Ultimate Tracker.exe or TwansUltimateTrackerSetup.exe
REM =============================================================================
REM Legacy name — use "Valorant Tracker.bat" instead.
cd /d "%~dp0"
call "%~dp0Valorant Tracker.bat" %*
exit /b %ERRORLEVEL%
