# Inventory Tracker with Real-time Sync

This application allows you to track inventory items across characters with real-time synchronization across multiple users. It features an encumbrance system that applies speed penalties based on inventory slots, character management with STR-based inventory capacity, and a drag-and-drop interface for item management.

## Project Overview

### Key Features
- Real-time synchronization of inventory changes across all users
- Visual notification when changes are synced from other users
- Connection status indicator
- Automatic fallback to local storage when offline
- Synchronizes when reconnected
- Character creation with STR-based slot calculations
- Encumbrance system that applies speed penalties (120' → 90'/60'/30')
- Item library with search functionality
- Drag & drop item management
- Data export/import for backup and sharing

### Directory Structure
```
inventory-tracker/
├── index.html              # Main application page
├── items.json              # Item database
├── README.md               # This documentation file
├── sync-test.html          # Testing guide and utilities
├── test-server.bat         # Windows server setup script
├── test-server.sh          # Unix/Linux/Mac server setup script
├── css/
│   └── styles.css          # Application styling
└── js/
    ├── characters.js       # Character management
    ├── export-import.js    # Data export/import functionality
    ├── firebase-config.js  # Firebase configuration
    ├── helpers.js          # Utility functions
    ├── items.js            # Item management
    ├── main.js             # Main application logic
    ├── state.js            # Application state management
    └── ui.js               # User interface components
```

## Running the Application

To run the application, you need to serve it from a web server (not just open the HTML file directly):

1. Use the provided test server scripts:
   - Windows: Run `test-server.bat`
   - Unix/Linux/Mac: Run `./test-server.sh` (make it executable with `chmod +x test-server.sh` first)
   
2. OR use one of these alternatives:
   - Python 3: `python -m http.server 8000`
   - Python 2: `python -m SimpleHTTPServer 8000`
   - Node.js: `npx http-server` (install with `npm install -g http-server` if needed)
   - VS Code: Use the Live Server extension

3. Open the application in your web browser at the URL shown by the server (typically http://localhost:8000/ or http://localhost:8080/)

4. Any changes made to characters or inventory will be synchronized in real-time across all connected users

## Testing the Application

A comprehensive testing guide is included in the `sync-test.html` file. To run the tests:

1. Start the local server using one of the methods above
2. Navigate to http://localhost:8000/sync-test.html (adjust port if different)
3. Follow the testing instructions on the page for:
   - Basic functionality testing
   - Real-time synchronization testing
   - Data export/import testing

The testing guide provides buttons to help you test specific features, such as:
- Opening multiple browser tabs to test synchronization
- Testing offline mode functionality
- Verifying server setup

## Firebase Setup Instructions

To enable real-time syncing across users, follow these steps to set up Firebase:

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Give your project a name (e.g., "inventory-tracker")
4. Optional: Enable Google Analytics if desired
5. Click "Create project"

### 2. Add a Web App to Your Project

1. From the project overview page, click the web icon (</>) to add a web app
2. Register your app with a nickname (e.g., "inventory-tracker-web")
3. Check "Also set up Firebase Hosting" if you plan to host the app
4. Click "Register app"
5. You'll be shown your Firebase configuration - keep this page open, you'll need it shortly

### 3. Set Up Realtime Database

1. From the left sidebar, select "Build" > "Realtime Database"
2. Click "Create database"
3. Start in test mode for development (we'll secure it later)
4. Choose a database location closest to your primary users
5. Click "Enable"

### 4. Configure Security Rules

1. In the Realtime Database section, go to the "Rules" tab
2. Replace the default rules with the following:

```json
{
  "rules": {
    "inventory": {
      ".read": true,
      ".write": true
    }
  }
}
```

3. Click "Publish"

Note: These rules allow anyone to read and write to your database. For production, you should implement proper authentication and more restrictive rules.

### 5. Update Firebase Configuration in the App

1. Open `env.js.example` in your code editor
2. Replace the placeholder configuration with the actual configuration from your Firebase project:

```javascript
window._env_ = {
  "FIREBASE_API_KEY": "your_api_key_here",
  "FIREBASE_AUTH_DOMAIN": "your_project_id.firebaseapp.com",
  "FIREBASE_DATABASE_URL": "https://your_project_id-default-rtdb.firebaseio.com",
  "FIREBASE_PROJECT_ID": "your_project_id",
  "FIREBASE_STORAGE_BUCKET": "your_project_id.appspot.com",
  "FIREBASE_MESSAGING_SENDER_ID": "your_sender_id",
  "FIREBASE_APP_ID": "your_app_id"
};
```
3. Save as `env.js`

## Development Notes

- The application uses Firebase Realtime Database for synchronization
- Each user session has a unique ID to prevent sync loops
- All character and inventory data is stored in the `inventory` node in the database
