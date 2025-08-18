/* ===== State & Persistence ===== */
import {
  database,
  ref,
  onValue,
  set,
  update,
  sessionId
} from './firebase-config.js';

// Initialize state with defaults
const state = {
  items: {},              // loaded from items.json
  chars: [],
  ui: { 
    leftCollapsed: false, 
    rightCollapsed: false,
    hiddenChars: []       // Track which characters are hidden
  },
  readOnlyMode: true      // Start in read-only mode by default
};

// Load state from local storage initially (for quick startup)
function loadLocalState() {
  try { 
    return JSON.parse(localStorage.getItem("inv_external_items_v5")||""); 
  } catch { 
    return null; 
  }
}

// Apply initial state from localStorage if available
const localState = loadLocalState();
if (localState) {
  if (Array.isArray(localState.items)) {
    const obj = {};
    localState.items.forEach((it, idx) => { obj[idx] = it; });
    localState.items = obj;
  }
  Object.assign(state, localState);
}

// Flag to prevent sync loops
let isSyncing = false;
let currentUid = null;
let unsubscribe = null;

// Build a path under the current user's scope
function userPath(subPath = '') {
  if (!currentUid) return null;
  return `inventory/${currentUid}${subPath ? '/' + subPath : ''}`;
}

// Update the current user and reinitialize sync
function setUser(uid) {
  currentUid = uid;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (uid) {
    initFirebaseSync();
  }
}

// Save state to local storage and Firebase
function saveState(path = null, value) {
  // Always save to localStorage for quick loading next time
  localStorage.setItem("inv_external_items_v5", JSON.stringify(state));

  // Don't sync to Firebase if we're currently processing a sync from Firebase
  // or if we're in read-only mode or no user is logged in
  if (isSyncing || state.readOnlyMode || !currentUid) return;

  if (path) {
    const fullPath = userPath(path);
    set(ref(database, fullPath), value);
    return;
  }

  // Save character state
  set(ref(database, userPath()), {
    chars: state.chars,
    lastUpdated: Date.now(),
    lastUpdatedBy: sessionId
  });
}

// Enable writes after user interaction with inventory or characters
function enableWrites() {
  if (state.readOnlyMode) {
    state.readOnlyMode = false;
    console.log("Read-only mode disabled. Changes will now sync to other users.");
    updateReadOnlyIndicator();
  }
}

// Update visual indicator for read-only mode
function updateReadOnlyIndicator() {
  const statusElement = document.getElementById('read-only-status');
  if (!statusElement) return;
  
  if (state.readOnlyMode) {
    statusElement.textContent = 'Read-Only Mode';
    statusElement.className = 'read-only';
    statusElement.style.display = 'block';
  } else {
    statusElement.textContent = 'Edit Mode';
    statusElement.className = 'edit-mode';
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
}

// Listen for changes from Firebase
function initFirebaseSync() {
  if (!currentUid) return;
  const inventoryRef = ref(database, userPath());
  unsubscribe = onValue(inventoryRef, (snapshot) => {
    const data = snapshot.val();
    
    // Ignore null data (first initialization)
    if (!data) return;
    
    // Skip if this update was triggered by the current session
    if (data.lastUpdatedBy === sessionId) return;
    
    // Flag that we're syncing to prevent loops
    isSyncing = true;
    
    // Update local state
    state.chars = data.chars || [];
    
    // Also update localStorage for faster loading next time
    localStorage.setItem("inv_external_items_v5", JSON.stringify(state));
    
    // Trigger UI update events
    const syncEvent = new CustomEvent('state-sync', { detail: { source: 'firebase' } });
    document.dispatchEvent(syncEvent);
    
    // Reset syncing flag
    isSyncing = false;
  });
}

export {
  state,
  saveState,
  initFirebaseSync,
  enableWrites,
  updateReadOnlyIndicator,
  setUser,
  userPath
};
