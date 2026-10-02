@echo off
title HAZARDGUARD Frontend Server
echo ============================================================
echo Serving HAZARDGUARD Frontend on http://localhost:5500
echo ============================================================

cd /d "%~dp0"
start http://localhost:5500
py -3.14 -m http.server 5500
if %ERRORLEVEL% NEQ 0 (
    python -m http.server 5500
)
pause
