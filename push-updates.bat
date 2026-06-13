@echo off
REM =============================================================================
REM DEVELOPER ONLY - GitHub deploy script for maintainers
REM =============================================================================
title Push Twans Ultimate Tracker to GitHub
setlocal EnableDelayedExpansion

cd /d "%~dp0"
set "SRC=%CD%"
set "REPO=%SRC%"
set "ONEDRIVE_MIRROR=C:\Users\H4unt\OneDrive\Documents\GitHub\Twans-Ultimate-Rl-Tracker"
set "LOG=%SRC%push-updates.log"

>>"%LOG%" echo.
>>"%LOG%" echo ===== %DATE% %TIME% =====
>>"%LOG%" echo push-updates.bat started in %SRC%

REM Non-interactive Git (avoids y/n loops when directory delete fails on Windows)
set "GIT_TERMINAL_PROMPT=0"
set "GIT_ASKPASS="
set "GCM_INTERACTIVE=Never"

echo.
echo  [1/6] Looking for Git from GitHub Desktop...
>>"%LOG%" echo Step 1: find Git

set "GIT="
for /d %%G in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do (
  if exist "%%G\resources\app\git\cmd\git.exe" set "GIT=%%G\resources\app\git\cmd\git.exe"
)

if not defined GIT (
  echo.
  echo  ERROR: Could not find Git from GitHub Desktop.
  echo  Open GitHub Desktop, select Twans-Ultimate-Rl-Tracker, and click Push origin.
  echo  Log: %LOG%
  >>"%LOG%" echo ERROR: Git not found
  call :Fail 1
)

echo  Found: %GIT%
>>"%LOG%" echo Git: !GIT!

echo.
echo  [2/6] Resolving git repo folder...
>>"%LOG%" echo Step 2: resolve REPO

if exist "%SRC%\.git\" (
  set "REPO=%SRC%"
  echo  Using project folder ^(rl-grind-tracker^): %REPO%
  >>"%LOG%" echo REPO=SRC %REPO%
) else if exist "%ONEDRIVE_MIRROR%\.git" (
  set "REPO=%ONEDRIVE_MIRROR%"
  echo  Using OneDrive mirror: %REPO%
  >>"%LOG%" echo REPO=OneDrive %REPO%
) else (
  echo.
  echo  ERROR: GitHub repo folder not found.
  echo    Tried: %SRC%
  echo    Tried: %ONEDRIVE_MIRROR%
  echo  Log: %LOG%
  >>"%LOG%" echo ERROR: no .git in SRC or OneDrive mirror
  call :Fail 1
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
  echo  [3/6] Copying deploy files to OneDrive mirror...
  >>"%LOG%" echo Step 3: copy to mirror
  echo  From: %SRC%
  echo  To:   %REPO%
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

  echo    docs + scripts ^(reference^)...
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
) else (
  echo.
  echo  [3/6] Skipping file copy - project folder is the git repo.
  >>"%LOG%" echo Step 3: skip copy, REPO=SRC
)

cd /d "%REPO%"
if errorlevel 1 (
  echo.
  echo  ERROR: Could not cd to repo: %REPO%
  >>"%LOG%" echo ERROR: cd failed
  call :Fail 1
)

if /I not "%REPO%"=="%SRC%" (
  echo.
  echo  [4/6] Committing copied files...
  >>"%LOG%" echo Step 4: commit mirror
  "%GIT%" add index.html css assets docs scripts tools tracker README.md .nojekyll .gitignore 2>nul

  "%GIT%" diff --cached --quiet
  if errorlevel 1 (
    "%GIT%" commit -m "Update download site from local project"
    if errorlevel 1 (
      echo  ERROR: Commit failed. Try GitHub Desktop instead.
      >>"%LOG%" echo ERROR: commit failed
      call :Fail 1
    )
    echo  Committed changes.
    >>"%LOG%" echo committed
  ) else (
    echo  No new file changes since last commit.
    >>"%LOG%" echo nothing to commit
  )
) else (
  echo  [4/6] Skipping mirror commit - pushing from project repo directly.
  >>"%LOG%" echo Step 4: skip commit, REPO=SRC
)

echo.
echo  [5/6] Preparing git sync...
>>"%LOG%" echo Step 5: PrepareGitSync
if /I not "%REPO%"=="%SRC%" (
  call :PrepareGitSync
) else (
  call :ClearStaleGitLock
)

echo.
"%GIT%" status -sb
echo.

echo  [6/6] Syncing with GitHub and pushing...
>>"%LOG%" echo Step 6: fetch merge push
"%GIT%" fetch origin
if errorlevel 1 (
  echo  ERROR: Fetch failed - check your internet connection.
  >>"%LOG%" echo ERROR: fetch failed
  call :Fail 1
)
"%GIT%" rev-parse --verify origin/main >nul 2>&1
if errorlevel 1 (
  echo  ERROR: origin/main not found after fetch.
  >>"%LOG%" echo ERROR: no origin/main
  call :Fail 1
)

"%GIT%" merge-base --is-ancestor origin/main HEAD >nul 2>&1
if not errorlevel 1 (
  echo  Local branch is up to date or ahead of origin/main.
  >>"%LOG%" echo sync: ahead or up to date
  goto :DoPush
)

"%GIT%" merge-base --is-ancestor HEAD origin/main >nul 2>&1
if not errorlevel 1 (
  echo  Merging origin/main into local branch...
  >>"%LOG%" echo sync: merge origin/main
  "%GIT%" merge origin/main --no-edit -X theirs
  if errorlevel 1 (
    echo  ERROR: Merge failed - close other Git processes, then run this script again.
    >>"%LOG%" echo ERROR: merge failed
    call :Fail 1
  )
  goto :DoPush
)

echo  Local branch diverged from origin/main; resetting to origin/main...
>>"%LOG%" echo sync: diverged, reset --hard
if /I not "%REPO%"=="%SRC%" call :RemoveLegacyRootSpaDirs
"%GIT%" reset --hard origin/main
if errorlevel 1 (
  echo  ERROR: Reset failed - close push-updates.bat / GitHub Desktop and retry.
  >>"%LOG%" echo ERROR: reset failed
  call :Fail 1
)

:DoPush
"%GIT%" push origin main
if errorlevel 1 (
  echo  ERROR: Push failed - open GitHub Desktop and click Push origin.
  >>"%LOG%" echo ERROR: push failed
  call :Fail 1
)

echo.
echo  Done! https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/
echo  Press Ctrl+Shift+R to bypass cache.
echo  Log: %LOG%
>>"%LOG%" echo SUCCESS
echo.
pause
exit /b 0

:Fail
echo.
echo  Push script failed. See messages above and log: %LOG%
echo.
pause
exit /b %~1

:PrepareGitSync
"%GIT%" merge --abort >nul 2>&1
call :ClearStaleGitLock
call :RemoveLegacyRootSpaDirs
exit /b 0

:ClearStaleGitLock
if not exist "%REPO%\.git\index.lock" exit /b 0
echo  Removing stale .git\index.lock ^(close other Git windows if this fails^)...
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
