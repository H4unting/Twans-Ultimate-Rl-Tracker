@echo off
title Push Twans Ultimate Tracker to GitHub
setlocal EnableDelayedExpansion

set "SRC=%~dp0"
set "REPO=C:\Users\H4unt\OneDrive\Documents\GitHub\Twans-Ultimate-Rl-Tracker"

REM Find Git from GitHub Desktop (any installed version)
set "GIT="
for /d %%G in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do (
  if exist "%%G\resources\app\git\cmd\git.exe" set "GIT=%%G\resources\app\git\cmd\git.exe"
)

if not defined GIT (
  echo.
  echo  Could not find Git from GitHub Desktop.
  echo  Open GitHub Desktop, select Twans-Ultimate-Rl-Tracker, and click Push origin.
  echo.
  pause
  exit /b 1
)

if not exist "%REPO%\.git" (
  echo.
  echo  GitHub repo folder not found:
  echo    %REPO%
  echo.
  echo  In GitHub Desktop: File ^> Add local repository ^> choose that folder.
  echo.
  pause
  exit /b 1
)

echo.
echo  ========================================
echo   Twans Ultimate Tracker - Push to GitHub
echo  ========================================
echo.
echo  Step 1: Copy latest files to GitHub repo...
echo    From: %SRC%
echo    To:   %REPO%
echo.

if not exist "%REPO%\assets" mkdir "%REPO%\assets"
if not exist "%REPO%\assets\setup" mkdir "%REPO%\assets\setup"

copy /Y "%SRC%index.html" "%REPO%\" >nul
copy /Y "%SRC%start-grind.bat" "%REPO%\" >nul
copy /Y "%SRC%README.md" "%REPO%\" >nul
copy /Y "%SRC%SETUP.md" "%REPO%\" >nul
if exist "%SRC%.nojekyll" copy /Y "%SRC%.nojekyll" "%REPO%\" >nul

xcopy "%SRC%css\*" "%REPO%\css\" /Y /Q /E >nul
xcopy "%SRC%js\*" "%REPO%\js\" /Y /Q /E >nul
xcopy "%SRC%scripts\*" "%REPO%\scripts\" /Y /Q /E >nul
if exist "%SRC%assets" xcopy "%SRC%assets\*" "%REPO%\assets\" /Y /Q /E /I >nul
if exist "%SRC%scripts" xcopy "%SRC%scripts\*" "%REPO%\scripts\" /Y /Q /E >nul
if exist "%SRC%supabase" xcopy "%SRC%supabase\*" "%REPO%\supabase\" /Y /Q /E /I >nul
if exist "%SRC%.gitignore" copy /Y "%SRC%.gitignore" "%REPO%\" >nul

echo  Files copied.
echo.
echo  Step 2: Commit and push...
echo.

cd /d "%REPO%"

"%GIT%" add index.html css js assets scripts supabase start-grind.bat README.md SETUP.md .nojekyll .gitignore 2>nul

"%GIT%" diff --cached --quiet
if errorlevel 1 (
  "%GIT%" commit -m "Update tracker from local project"
  if errorlevel 1 (
    echo  Commit failed. Try GitHub Desktop instead.
    pause
    exit /b 1
  )
  echo  Committed changes.
) else (
  echo  No new file changes since last commit.
)

echo.
"%GIT%" status -sb
echo.

"%GIT%" push origin main
if errorlevel 1 (
  echo.
  echo  Push failed — open GitHub Desktop and click Push origin.
  echo  Repo path: %REPO%
  echo.
  pause
  exit /b 1
)

echo.
echo  Done! Wait ~1 minute, then open:
echo  https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/
echo  Press Ctrl+Shift+R to bypass cache.
echo.
pause
