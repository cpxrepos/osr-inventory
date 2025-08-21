/* ===== Firebase Configuration ===== */

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js';
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  push,
  get,
  child,
  serverTimestamp,
  runTransaction,
  remove
} from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js';

// Firebase configuration loaded from environment variables
const firebaseConfig = {
  apiKey: window._env_.FIREBASE_API_KEY,
  authDomain: window._env_.FIREBASE_AUTH_DOMAIN,
  databaseURL: window._env_.FIREBASE_DATABASE_URL,
  projectId: window._env_.FIREBASE_PROJECT_ID,
  storageBucket: window._env_.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window._env_.FIREBASE_MESSAGING_SENDER_ID,
  appId: window._env_.FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Generate a unique ID for this user's session if they don't have one
let sessionId = localStorage.getItem("inventory_session_id");
if (!sessionId) {
  sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  localStorage.setItem("inventory_session_id", sessionId);
}

// Export Firebase modules and initialized instances
export {
  database,
  ref,
  onValue,
  set,
  update,
  push,
  get,
  child,
  serverTimestamp,
  runTransaction,
  remove,
  sessionId
};
