@echo off
REM =============================================================================
REM DEVELOPER ONLY — GitHub deploy script for maintainers
REM =============================================================================
title Push Twans Ultimate Tracker to GitHub
setlocal EnableDelayedExpansion

set "SRC=%~dp0"
set "REPO=%SRC%"
set "ONEDRIVE_MIRROR=C:\Users\H4unt\OneDrive\Documents\GitHub\Twans-Ultimate-Rl-Tracker"

REM Non-interactive Git (avoids y/n loops when directory delete fails on Windows)
set "GIT_TERMINAL_PROMPT=0"
set "GIT_ASKPASS="
set "GCM_INTERACTIVE=Never"

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

if exist "%SRC%.git\" (
  set "REPO=%SRC%"
) else if exist "%ONEDRIVE_MIRROR%\.git" (
  set "REPO=%ONEDRIVE_MIRROR%"
) else if not exist "%REPO%\.git" (
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
echo  Project:  %SRC%
echo  Git repo: %REPO%
if /I not "%REPO%"=="%SRC%" (
echo.
echo  Copying from: %SRC%
echo  To:           %REPO%
echo.
for %%D in (assets css docs docs\supabase scripts tools tools\launcher tools\launcher\src tools\launcher\scripts tracker) do (
  if not exist "%REPO%\%%D" mkdir "%REPO%\%%D"
)

echo    Download landing page...
copy /Y "%SRC%index.html" "%REPO%\" >nul
if exist "%SRC%css\download.css" (
  if not exist "%REPO%\css" mkdir "%REPO%\css"
  copy /Y "%SRC%css\download.css" "%REPO%\css\" >nul
)
if exist "%SRC%assets\brand" (
  if not exist "%REPO%\assets\brand" mkdir "%REPO%\assets\brand"
  xcopy "%SRC%assets\brand\*" "%REPO%\assets\brand\" /Y /Q /E /I >nul
)

echo    docs + scripts (reference)...
xcopy "%SRC%docs\*" "%REPO%\docs\" /Y /Q /E /I >nul
xcopy "%SRC%scripts\*" "%REPO%\scripts\" /Y /Q /E /I >nul

if exist "%SRC%tools\launcher\package.json" (
  echo    tools/launcher source...
  copy /Y "%SRC%tools\launcher\package.json" "%REPO%\tools\launcher\" >nul
  if exist "%SRC%tools\launcher\package-lock.json" copy /Y "%SRC%tools\launcher\package-lock.json" "%REPO%\tools\launcher\" >nul
  if exist "%SRC%tools\launcher\README.md" copy /Y "%SRC%tools\launcher\README.md" "%REPO%\tools\launcher\" >nul
  if exist "%SRC%tools\launcher\src" xcopy "%SRC%tools\launcher\src\*" "%REPO%\tools\launcher\src\" /Y /Q /E /I >nul
  if exist "%SRC%tools\launcher\scripts" xcopy "%SRC%tools\launcher\scripts\*" "%REPO%\tools\launcher\scripts\" /Y /Q /E /I >nul
)

copy /Y "%SRC%README.md" "%REPO%\" >nul
if exist "%SRC%.nojekyll" copy /Y "%SRC%.nojekyll" "%REPO%\" >nul
if exist "%SRC%.gitignore" copy /Y "%SRC%.gitignore" "%REPO%\" >nul
echo    tracker SPA...
if exist "%SRC%tracker" xcopy "%SRC%tracker\*" "%REPO%\tracker\" /Y /Q /E /I >nul
)

if /I not "%REPO%"=="%SRC%" (
echo.
echo  Files copied. Committing...
echo.

cd /d "%REPO%"

"%GIT%" add index.html css assets docs scripts tools tracker README.md .nojekyll .gitignore 2>nul

"%GIT%" diff --cached --quiet
if errorlevel 1 (
  "%GIT%" commit -m "Update download site from local project"
  if errorlevel 1 (
    echo  Commit failed. Try GitHub Desktop instead.
    pause
    exit /b 1
  )
  echo  Committed changes.
) else (
  echo  No new file changes since last commit.
)
) else (
  echo  Using project folder as git repo (no OneDrive file copy).
  echo.
  cd /d "%REPO%"
)

call :PrepareGitSync

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
"%GIT%" rev-parse --verify origin/main >nul 2>&1
if errorlevel 1 (
  echo  origin/main not found after fetch.
  pause
  exit /b 1
)

"%GIT%" merge-base --is-ancestor HEAD origin/main >nul 2>&1
if errorlevel 1 (
  echo  Local branch diverged from origin/main; resetting to origin/main...
  call :RemoveLegacyRootSpaDirs
  "%GIT%" reset --hard origin/main
  if errorlevel 1 (
    echo  Reset failed - close push-updates.bat / GitHub Desktop and retry.
    pause
    exit /b 1
  )
) else (
  "%GIT%" merge origin/main --no-edit -X theirs
  if errorlevel 1 (
    echo  Merge failed - close other Git processes, then run this script again.
    pause
    exit /b 1
  )
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

:PrepareGitSync
"%GIT%" merge --abort >nul 2>&1
call :ClearStaleGitLock
call :RemoveLegacyRootSpaDirs
exit /b 0

:ClearStaleGitLock
if not exist "%REPO%\.git\index.lock" exit /b 0
echo  Removing stale .git\index.lock (close other Git windows if this fails)...
del /f /q "%REPO%\.git\index.lock" >nul 2>&1
exit /b 0

:RemoveLegacyRootSpaDirs
for %%D in (config js css legal public integrations) do (
  if exist "%REPO%\%%D" (
    rd /s /q "%REPO%\%%D" >nul 2>&1
    if exist "%REPO%\%%D" (
      echo  Could not remove %%D\ - close File Explorer, OneDrive, or the tracker app, then retry.
    )
  )
)
exit /b 0
