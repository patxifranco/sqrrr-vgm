@echo off
title VGM Guess Server
cd /d "%~dp0"

echo.
echo ========================================
echo    VGM Guess - Video Game Music Game
echo ========================================
echo.
echo Server starting...
echo.
echo Open this in your browser:
echo    http://localhost:3000
echo.
echo To stop the server, close this window.
echo ========================================
echo.

node server.js

pause
