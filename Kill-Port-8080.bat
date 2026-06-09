@echo off
title Free port 8080 for Twans Ultimate Tracker
cd /d "%~dp0"

echo.
echo  =================================
echo   Free port 8080
echo  =================================
echo.
echo  Use this when a tracker .bat says port 8080 is in use (after closing old tracker windows).
echo  Common blockers: VS Code Live Server, Live Preview, npx serve.
echo.

netstat -ano | findstr :8080
if errorlevel 1 (
  echo  Port 8080 looks free ??? run Rocket League Tracker.bat or Valorant Tracker (Player).bat again.
  pause
  exit /b 0
)

echo.
echo  Find the PID in the rightmost column above ^(often Live Server or node^).
echo  Then run:  taskkill /PID ^<pid^> /F
echo.
echo  Example:  taskkill /PID 12345 /F
echo.
set /p KILLPID=Enter PID to kill (or press Enter to skip): 
if "%KILLPID%"=="" (
  echo  Skipped ??? close Live Server manually, then run Valorant Tracker.bat.
  pause
  exit /b 0
)

taskkill /PID %KILLPID% /F
if errorlevel 1 (
  echo  Could not kill PID %KILLPID% ??? try closing the app manually.
) else (
  echo  PID %KILLPID% stopped. run Rocket League Tracker.bat or Valorant Tracker (Player).bat again.
)
echo.
pause

