@echo off
setlocal
echo ===========================================
echo   GEMINI BRIDGE - NATIVE LAUNCHER SETUP
echo ===========================================
echo.

set "KEY_NAME=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.gemini.bridge.launcher"
set "MANIFEST_PATH=%~dp0host_manifest.json"

:: ==========================================
:: CONFIGURATION (For Distribution)
:: If you publish to the Chrome Web Store, paste your fixed ID here
:: to skip the manual step for your users.
set "PREDEFINED_ID="
:: ==========================================

if not "%PREDEFINED_ID%"=="" (
    set "EXT_ID=%PREDEFINED_ID%"
    goto :INSTALL
)

:: 1. Ask for Extension ID
echo Open Chrome and go to chrome://extensions
echo Copy the ID of 'Gemini Bridge' (e.g., mdf... or ppp...)
echo.
set /p EXT_ID="Paste Extension ID here: "

:INSTALL
if "%EXT_ID%"=="" (
    echo Error: ID cannot be empty.
    pause
    exit /b
)

:: 2. Update manifest file with ID
powershell -Command "(Get-Content '%MANIFEST_PATH%').Replace('REPLACE_WITH_EXTENSION_ID', '%EXT_ID%') | Set-Content '%MANIFEST_PATH%'"
echo Manifest updated with ID: %EXT_ID%

:: 3. Add to Registry
reg add "%KEY_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f

echo.
echo ===========================================
echo   SUCCESS! Launcher registered.
echo ===========================================
pause
