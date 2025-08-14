@echo off
echo ========================================
echo Inventory Tracker Test Server
echo ========================================
echo.
echo This script will start a local HTTP server for testing the Inventory Tracker app.
echo.

:: Check if Python is available
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Python detected. Starting server with Python...
    echo.
    echo Server starting at http://localhost:8000/
    echo.
    echo To test the app:
    echo 1. Open your browser to http://localhost:8000/sync-test.html
    echo 2. Follow the testing instructions on that page
    echo.
    echo Press Ctrl+C to stop the server when done
    echo ========================================
    echo.
    python -m http.server 8000
    goto :eof
)

:: Check if Python 3 is available as py
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Python (py) detected. Starting server with Python...
    echo.
    echo Server starting at http://localhost:8000/
    echo.
    echo To test the app:
    echo 1. Open your browser to http://localhost:8000/sync-test.html
    echo 2. Follow the testing instructions on that page
    echo.
    echo Press Ctrl+C to stop the server when done
    echo ========================================
    echo.
    py -m http.server 8000
    goto :eof
)

:: Check if Node.js is available
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Node.js detected. Checking for http-server package...
    
    :: Check if http-server is installed
    node -e "try { require.resolve('http-server'); console.log('http-server found'); } catch(e) { console.log('http-server not found'); process.exit(1); }" >nul 2>nul
    
    if %ERRORLEVEL% EQU 0 (
        echo Starting server with http-server...
        echo.
        echo Server starting at http://localhost:8080/
        echo.
        echo To test the app:
        echo 1. Open your browser to http://localhost:8080/sync-test.html
        echo 2. Follow the testing instructions on that page
        echo.
        echo Press Ctrl+C to stop the server when done
        echo ========================================
        echo.
        npx http-server -p 8080
        goto :eof
    ) else (
        echo http-server not found. Would you like to install it? (Y/N)
        set /p INSTALL=
        if /i "%INSTALL%"=="Y" (
            echo Installing http-server...
            npm install -g http-server
            echo Starting server with http-server...
            echo.
            echo Server starting at http://localhost:8080/
            echo.
            echo To test the app:
            echo 1. Open your browser to http://localhost:8080/sync-test.html
            echo 2. Follow the testing instructions on that page
            echo.
            echo Press Ctrl+C to stop the server when done
            echo ========================================
            echo.
            http-server -p 8080
            goto :eof
        )
    )
)

:: If we get here, no suitable server was found
echo.
echo No suitable web server was found on your system.
echo.
echo To test the Inventory Tracker app, you need one of the following:
echo 1. Python 3 installed
echo 2. Node.js with http-server package installed
echo.
echo Please install one of these and try again, or use VS Code with Live Server extension.
echo.
pause
