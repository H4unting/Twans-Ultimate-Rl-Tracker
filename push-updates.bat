@echo off
REM =============================================================================
REM DEVELOPER ONLY — GitHub deploy script for maintainers
REM =============================================================================
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
  pause
  exit /b 1
)

echo.
echo  ========================================
echo   Twans Ultimate Tracker - Push to GitHub
echo  ========================================
echo.
echo  Copying from: %SRC%
echo  To:           %REPO%
echo.

for %%D in (assets css js scripts config docs docs\supabase integrations integrations\overwolf tools tools\launcher tools\launcher\src tools\launcher\scripts) do (
  if not exist "%REPO%\%%D" mkdir "%REPO%\%%D"
)

echo    Site + launchers...
node "%SRC%scripts\sync-version.mjs"
if errorlevel 1 (
  echo  sync-version.mjs failed — check Node.js is installed.
  pause
  exit /b 1
)
copy /Y "%SRC%index.html" "%REPO%\" >nul
copy /Y "%SRC%version.json" "%REPO%\" >nul
copy /Y "%SRC%Rocket League Tracker.bat" "%REPO%\" >nul
copy /Y "%SRC%Valorant Tracker.bat" "%REPO%\" >nul
copy /Y "%SRC%start-grind.bat" "%REPO%\" >nul
copy /Y "%SRC%start-val-grind.bat" "%REPO%\" >nul
copy /Y "%SRC%build-tray-app.bat" "%REPO%\" >nul
copy /Y "%SRC%README.md" "%REPO%\" >nul
if exist "%SRC%.nojekyll" copy /Y "%SRC%.nojekyll" "%REPO%\" >nul
if exist "%SRC%.gitignore" copy /Y "%SRC%.gitignore" "%REPO%\" >nul

echo    css, js, scripts...
if exist "%REPO%\js\js" rd /s /q "%REPO%\js\js"
if exist "%SRC%js\js" rd /s /q "%SRC%js\js"
xcopy "%SRC%css\*" "%REPO%\css\" /Y /Q /E >nul
xcopy "%SRC%js\*" "%REPO%\js\" /Y /Q /E >nul
xcopy "%SRC%scripts\*" "%REPO%\scripts\" /Y /Q /E >nul

if exist "%SRC%assets" xcopy "%SRC%assets\*" "%REPO%\assets\" /Y /Q /E /I >nul

echo    docs + config templates...
xcopy "%SRC%docs\*" "%REPO%\docs\" /Y /Q /E /I >nul
if exist "%SRC%config\example.grind-config.json" copy /Y "%SRC%config\example.grind-config.json" "%REPO%\config\" >nul
if exist "%SRC%config\README.md" copy /Y "%SRC%config\README.md" "%REPO%\config\" >nul
if exist "%SRC%config\bridge-launcher.json" copy /Y "%SRC%config\bridge-launcher.json" "%REPO%\config\" >nul

if exist "%SRC%integrations\overwolf" (
  echo    integrations/overwolf...
  xcopy "%SRC%integrations\overwolf\*" "%REPO%\integrations\overwolf\" /Y /Q /E /I >nul
)

if exist "%SRC%tools\launcher\package.json" (
  echo    tools/launcher source...
  copy /Y "%SRC%tools\launcher\package.json" "%REPO%\tools\launcher\" >nul
  if exist "%SRC%tools\launcher\package-lock.json" copy /Y "%SRC%tools\launcher\package-lock.json" "%REPO%\tools\launcher\" >nul
  if exist "%SRC%tools\launcher\build-bridge.bat" copy /Y "%SRC%tools\launcher\build-bridge.bat" "%REPO%\tools\launcher\" >nul
  if exist "%SRC%tools\launcher\README.md" copy /Y "%SRC%tools\launcher\README.md" "%REPO%\tools\launcher\" >nul
  if exist "%SRC%tools\launcher\src" xcopy "%SRC%tools\launcher\src\*" "%REPO%\tools\launcher\src\" /Y /Q /E /I >nul
  if exist "%SRC%tools\launcher\scripts" xcopy "%SRC%tools\launcher\scripts\*" "%REPO%\tools\launcher\scripts\" /Y /Q /E /I >nul
)

echo.
echo  Files copied. Committing...
echo.

cd /d "%REPO%"

"%GIT%" add index.html version.json css js assets scripts config docs integrations tools "Rocket League Tracker.bat" "Valorant Tracker.bat" start-grind.bat start-val-grind.bat build-tray-app.bat README.md .nojekyll .gitignore 2>nul

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

echo  Syncing with GitHub before push...
"%GIT%" fetch origin
if errorlevel 1 (
  echo  Fetch failed - check your internet connection.
  pause
  exit /b 1
)
"%GIT%" merge origin/main --no-edit
if errorlevel 1 (
  echo  Merge failed - open GitHub Desktop, pull origin, fix conflicts, then push.
  pause
  exit /b 1
)

"%GIT%" push origin main
if errorlevel 1 (
  echo  Push failed — open GitHub Desktop and click Push origin.
  pause
  exit /b 1
)

echo.
echo  Done! https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/
echo  Press Ctrl+Shift+R to bypass cache.
echo.
pause
