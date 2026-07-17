@echo off
chcp 65001 >nul
cd /d "%~dp0"
node src/seed.js
echo.
echo 正在启动招生登记系统...
start "" http://localhost:3000
node src/server.js
pause
