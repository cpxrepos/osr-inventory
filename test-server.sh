#!/bin/bash

echo "========================================"
echo "Inventory Tracker Test Server"
echo "========================================"
echo
echo "This script will start a local HTTP server for testing the Inventory Tracker app."
echo

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "Python 3 detected. Starting server with Python..."
    echo
    echo "Server starting at http://localhost:8000/"
    echo
    echo "To test the app:"
    echo "1. Open your browser to http://localhost:8000/sync-test.html"
    echo "2. Follow the testing instructions on that page"
    echo
    echo "Press Ctrl+C to stop the server when done"
    echo "========================================"
    echo
    python3 -m http.server 8000
    exit 0
fi

# Check if Python 2 is available
if command -v python &> /dev/null; then
    # Check if it's Python 2 or 3
    PY_VERSION=$(python --version 2>&1 | awk '{print $2}' | cut -d '.' -f 1)
    if [ "$PY_VERSION" = "2" ]; then
        echo "Python 2 detected. Starting server with Python..."
        echo
        echo "Server starting at http://localhost:8000/"
        echo
        echo "To test the app:"
        echo "1. Open your browser to http://localhost:8000/sync-test.html"
        echo "2. Follow the testing instructions on that page"
        echo
        echo "Press Ctrl+C to stop the server when done"
        echo "========================================"
        echo
        python -m SimpleHTTPServer 8000
        exit 0
    else
        echo "Python 3 detected. Starting server with Python..."
        echo
        echo "Server starting at http://localhost:8000/"
        echo
        echo "To test the app:"
        echo "1. Open your browser to http://localhost:8000/sync-test.html"
        echo "2. Follow the testing instructions on that page"
        echo
        echo "Press Ctrl+C to stop the server when done"
        echo "========================================"
        echo
        python -m http.server 8000
        exit 0
    fi
fi

# Check if Node.js is available
if command -v node &> /dev/null; then
    echo "Node.js detected. Checking for http-server package..."
    
    # Check if http-server is installed globally
    if command -v http-server &> /dev/null; then
        echo "Starting server with http-server..."
        echo
        echo "Server starting at http://localhost:8080/"
        echo
        echo "To test the app:"
        echo "1. Open your browser to http://localhost:8080/sync-test.html"
        echo "2. Follow the testing instructions on that page"
        echo
        echo "Press Ctrl+C to stop the server when done"
        echo "========================================"
        echo
        http-server -p 8080
        exit 0
    else
        echo "http-server not found. Would you like to install it? (Y/N)"
        read -r INSTALL
        if [[ "$INSTALL" =~ ^[Yy]$ ]]; then
            echo "Installing http-server..."
            npm install -g http-server
            echo "Starting server with http-server..."
            echo
            echo "Server starting at http://localhost:8080/"
            echo
            echo "To test the app:"
            echo "1. Open your browser to http://localhost:8080/sync-test.html"
            echo "2. Follow the testing instructions on that page"
            echo
            echo "Press Ctrl+C to stop the server when done"
            echo "========================================"
            echo
            http-server -p 8080
            exit 0
        fi
    fi
fi

# If we get here, no suitable server was found
echo
echo "No suitable web server was found on your system."
echo
echo "To test the Inventory Tracker app, you need one of the following:"
echo "1. Python 3 installed"
echo "2. Python 2 installed"
echo "3. Node.js with http-server package installed"
echo
echo "Please install one of these and try again, or use VS Code with Live Server extension."
echo
read -p "Press Enter to continue..."
