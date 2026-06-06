@echo off
REM Legacy name — use "Valorant Tracker.bat" instead.
cd /d "%~dp0"
call "%~dp0Valorant Tracker.bat" %*
exit /b %ERRORLEVEL%
