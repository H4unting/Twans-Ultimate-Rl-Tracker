@echo off
title Push Twans Ultimate Tracker updates to GitHub
cd /d "%~dp0"

set GIT=%LOCALAPPDATA%\GitHubDesktop\app-3.5.11\resources\app\git\cmd\git.exe
if not exist "%GIT%" (
  echo Could not find Git from GitHub Desktop.
  echo Open GitHub Desktop, select this repo, and click Push origin.
  pause
  exit /b 1
)

echo.
echo  Checking for unpushed commits...
echo.
"%GIT%" status -sb
echo.

"%GIT%" log --oneline origin/main..HEAD 2>nul
if errorlevel 1 (
  echo Fetching remote...
  "%GIT%" fetch origin
)

for /f %%i in ('"%GIT%" rev-list --count origin/main..HEAD 2^>nul') do set AHEAD=%%i
if "%AHEAD%"=="0" (
  echo  Nothing to push — already up to date with GitHub.
  echo  Hard-refresh the site: Ctrl+Shift+R
  pause
  exit /b 0
)

echo  Pushing %AHEAD% commit(s) to GitHub...
"%GIT%" push origin main
if errorlevel 1 (
  echo.
  echo  Push failed — use GitHub Desktop: Repository ^> Push origin
  pause
  exit /b 1
)

echo.
echo  Done! Wait ~1 minute, then open:
echo  https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/
echo  Press Ctrl+Shift+R to bypass cache.
echo.
pause
