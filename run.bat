@echo off
echo ===================================================
echo   Python Expense Tracker Launcher
echo ===================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python.
    pause
    exit /b 1
)

:: Check for WebView2 Runtime
set "WV2_1=HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
set "WV2_2=HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
set "WV2_3=HKCU\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

reg query "%WV2_1%" /v pv >nul 2>&1
if %errorlevel% equ 0 goto :WebView2Ok

reg query "%WV2_2%" /v pv >nul 2>&1
if %errorlevel% equ 0 goto :WebView2Ok

reg query "%WV2_3%" /v pv >nul 2>&1
if %errorlevel% equ 0 goto :WebView2Ok

echo [WARNING] Microsoft Edge WebView2 Runtime was not detected on this system.
echo           This is required by PyWebView to render the GUI interface.
echo.
echo Attempting to install WebView2 Runtime using Windows Package Manager (winget)...
winget install --id=Microsoft.EdgeWebView2Runtime -e --accept-source-agreements --accept-package-agreements
if %errorlevel% equ 0 (
    echo [INFO] WebView2 Runtime installed successfully.
    echo.
    goto :WebView2Ok
)

echo.
echo [ERROR] WebView2 Runtime could not be installed automatically.
echo         Please download and install it manually from:
echo         https://developer.microsoft.com/en-us/microsoft-edge/webview2/
echo.
pause
exit /b 1

:WebView2Ok

:: Check if virtual environment exists, if not create it
if not exist .venv (
    echo [INFO] Creating Python virtual environment...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [INFO] Virtual environment created successfully.
)

:: Activate virtual environment
echo [INFO] Activating virtual environment...
call .venv\Scripts\activate.bat

:: Install requirements
echo [INFO] Checking and installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo [INFO] Starting the Expense Tracker GUI...
echo [INFO] You can close this command window after you exit the application.
echo.

:: Run app
python backend/app.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] The application crashed or exited with an error.
    pause
)
