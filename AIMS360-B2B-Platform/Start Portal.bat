@echo off
title AIMS360 B2B Portal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed on this computer yet.
  echo  The download page is opening now. Install the LTS version with the
  echo  default options, then double-click "Start Portal" again.
  echo.
  start "" https://nodejs.org/en/download
  pause
  exit /b
)

if not exist node_modules (
  echo  First-time setup, this takes a minute...
  call npm install --omit=dev --no-audit --no-fund
)
if not exist dist (
  echo  Building the portal screens...
  call npm install --no-audit --no-fund
  call npm run build
)

echo.
echo  AIMS360 B2B Portal is running at http://localhost:3000
echo  Keep this window open while you use it. Close it to stop the portal.
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
node server\index.js
pause
