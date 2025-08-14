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
  child
} from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js';

// Firebase configuration
// Replace these with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyAanTymL4ERBbH_WaLSE9w6sDazPUk600o",
  authDomain: "osr-inventory.firebaseapp.com",
  databaseURL: "https://osr-inventory-default-rtdb.firebaseio.com",
  projectId: "osr-inventory",
  storageBucket: "osr-inventory.firebasestorage.app",
  messagingSenderId: "571731379953",
  appId: "1:571731379953:web:64ad01944c806b329ccb50"
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
  sessionId
};
