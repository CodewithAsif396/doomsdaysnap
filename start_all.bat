@echo off
TITLE Doomsdaysnap All-In-One Starter
echo ==========================================
echo    Doomsdaysnap Background Engines
echo ==========================================

echo [1/2] Starting YouTube Engine (Port 5002)...
start "YouTube Engine" /min cmd /c python youtube_server.py

echo [2/2] Starting Doomsdaysnap Main Server (Port 3000)...
echo Wait 3 seconds for engine to initialize...
timeout /t 3 >nul

node server.js

pause
