@echo off
title HAZARDGUARD Backend Server
echo ============================================================
echo Starting HAZARDGUARD Intelligent Safety Monitoring Backend...
echo Base URL: http://localhost:8000
echo Swagger Docs: http://localhost:8000/docs
echo SQLite DB: ..\data\hazardguard.db
echo ============================================================

cd /d "%~dp0"
py -3.14 main.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Python 3.14 launch failed. Trying default python...
    python main.py
)
pause
