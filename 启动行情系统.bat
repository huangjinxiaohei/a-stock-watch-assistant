@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "API_DIR=%ROOT%\stock-api"
set "WEB_DIR=%ROOT%\stock-web"
set "API_PYTHON=%API_DIR%\.venv\Scripts\python.exe"
set "WEB_START=%WEB_DIR%\run-web-dev.cmd"
set "API_URL=http://127.0.0.1:8787/"
set "WEB_URL=http://127.0.0.1:5173/"

cd /d "%ROOT%"
title Stock Watch Dev Starter

echo.
echo ========================================
echo  Stock Watch Dev Starter
echo ========================================
echo Project root: %ROOT%
echo.

if not exist "%API_DIR%\" (
  echo [ERROR] Backend directory not found: %API_DIR%
  goto :Fail
)

if not exist "%WEB_DIR%\" (
  echo [ERROR] Frontend directory not found: %WEB_DIR%
  goto :Fail
)

if not exist "%API_PYTHON%" (
  echo [ERROR] Backend Python venv was not found:
  echo         %API_PYTHON%
  echo.
  echo Please restore or recreate stock-api\.venv before starting.
  goto :Fail
)

if not exist "%WEB_START%" (
  echo [ERROR] Frontend start script was not found:
  echo         %WEB_START%
  goto :Fail
)

call :IsPortListening 8787
if "%ERRORLEVEL%"=="0" (
  echo [API] Port 8787 is already listening. Reusing existing service: %API_URL%
) else (
  echo [API] Starting backend: %API_URL%
  start "stock-api 8787" /D "%API_DIR%" cmd /k ""%API_PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8787"
)

call :IsPortListening 5173
if "%ERRORLEVEL%"=="0" (
  echo [WEB] Port 5173 is already listening. Reusing existing service: %WEB_URL%
) else (
  echo [WEB] Starting frontend: %WEB_URL%
  start "stock-web 5173" /D "%WEB_DIR%" cmd /k ""%WEB_START%""
)

echo.
echo Waiting for frontend port 5173...
call :WaitForPort 5173 30
if "%ERRORLEVEL%"=="0" (
  echo [OK] Frontend is available: %WEB_URL%
  start "" "%WEB_URL%"
) else (
  echo [WARN] Frontend is not ready yet. Open it manually later: %WEB_URL%
)

echo.
echo Backend:  %API_URL%
echo Frontend: %WEB_URL%
echo.
echo You can close this launcher window. Service windows will keep running.
pause
exit /b 0

:Fail
echo.
echo Startup failed. No data was modified.
pause
exit /b 1

:IsPortListening
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>nul
exit /b %ERRORLEVEL%

:WaitForPort
set "WAIT_PORT=%~1"
set "WAIT_SECONDS=%~2"
for /L %%I in (1,1,%WAIT_SECONDS%) do (
  call :IsPortListening %WAIT_PORT%
  if not errorlevel 1 exit /b 0
  timeout /t 1 /nobreak >nul
)
exit /b 1