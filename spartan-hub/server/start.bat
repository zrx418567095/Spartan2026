@echo off
chcp 65001 >nul 2>&1
title Spartan Hub Server
cd /d %~dp0

set PORT=3000

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)

set CMD=%1
if "%CMD%"=="" set CMD=start

if "%CMD%"=="start" goto start
if "%CMD%"=="stop" goto stop
if "%CMD%"=="restart" goto restart
if "%CMD%"=="status" goto status
if "%CMD%"=="logs" goto logs
if "%CMD%"=="fg" goto fg
if "%CMD%"=="reset" goto reset
goto usage

:usage
echo Usage: start.bat [command]
echo   start     Start server (background)
echo   stop      Stop server
echo   restart   Restart server
echo   status    Check status
echo   logs      View logs
echo   fg        Run in foreground
echo   reset     Reset database
exit /b 0

:start
echo Starting server...
set HOST=0.0.0.0
start /b cmd /c "set HOST=0.0.0.0 && node index.js" > server.log 2>&1
echo Server started, log: server.log
echo Access: http://localhost:%PORT%
exit /b 0

:stop
echo Stopping server...
taskkill /f /im node.exe >nul 2>&1
echo Server stopped
exit /b 0

:restart
call :stop
timeout /t 2 >nul
call :start
exit /b 0

:status
tasklist /fi "imagename eq node.exe" | findstr /i "node" >nul
if %ERRORLEVEL% equ 0 (
    echo Running
) else (
    echo Not running
)
exit /b 0

:logs
if exist server.log (
    type server.log
) else (
    echo No log file
)
exit /b 0

:fg
echo Running in foreground, Ctrl+C to stop
set HOST=0.0.0.0
node index.js
exit /b 0

:reset
set /p c=Reset database? (y/N):
if /i "%c%"=="y" (
    del /f database.sqlite >nul 2>&1
    del /f database.sqlite-journal >nul 2>&1
    echo Database reset
) else (
    echo Cancelled
)
exit /b 0
