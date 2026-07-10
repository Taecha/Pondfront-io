@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "LAUNCHER=%SCRIPT_DIR%Start-PondFront.ps1"

if not exist "%LAUNCHER%" (
  echo PondFront launcher was not found.
  echo Expected: %LAUNCHER%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%"
