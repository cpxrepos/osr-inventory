/* ===== State & Persistence ===== */
import {
  database,
  ref,
  onValue,
  set,
  get,
  child,
  runTransaction,
  serverTimestamp,
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
  readOnlyMode: true,     // Start in read-only mode by default
  lastUpdated: 0
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

// Helper to set a nested value in an object using a slash-delimited path
function setByPath(obj, path, value) {
  const parts = path.split('/');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!(p in cur)) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

// Save state to local storage and Firebase
async function saveState(path = null, value) {
  // Always save to localStorage for quick loading next time
  localStorage.setItem("inv_external_items_v5", JSON.stringify(state));

  // Don't sync to Firebase if we're currently processing a sync from Firebase
  // or if we're in read-only mode and haven't had user interaction yet
  if (isSyncing || state.readOnlyMode) return;

  // Paths outside inventory can be written directly without timestamp checks
  if (path && !path.startsWith('inventory')) {
    await set(ref(database, path), value);
    return;
  }

  const inventoryRef = ref(database, 'inventory');

  // Fetch remote lastUpdated for comparison
  try {
    const remoteSnap = await get(child(inventoryRef, 'lastUpdated'));
    const remoteLastUpdated = remoteSnap.exists() ? remoteSnap.val() : 0;
    if (remoteLastUpdated > state.lastUpdated) {
      console.warn('Remote state is newer; skipping save.');
      return;
    }
  } catch (err) {
    console.warn('Could not check remote lastUpdated:', err);
  }

  // Use transaction to handle concurrent writes with timestamp comparison
  try {
    const result = await runTransaction(inventoryRef, (current) => {
      if (current && current.lastUpdated > state.lastUpdated) {
        return; // Abort - remote is newer
      }
      const updated = current || {};
      if (path) {
        const rel = path.slice('inventory/'.length);
        setByPath(updated, rel, value);
      } else {
        updated.chars = state.chars;
      }
      updated.lastUpdated = serverTimestamp();
      updated.lastUpdatedBy = sessionId;
      return updated;
    });
    if (result.committed) {
      state.lastUpdated = result.snapshot.val().lastUpdated || state.lastUpdated;
      localStorage.setItem("inv_external_items_v5", JSON.stringify(state));
    }
  } catch (err) {
    console.error('Failed to save state:', err);
  }
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
  const inventoryRef = ref(database, 'inventory');
  onValue(inventoryRef, (snapshot) => {
    const data = snapshot.val();

    // Ignore null data (first initialization)
    if (!data) return;

    // Store remote last updated timestamp
    state.lastUpdated = data.lastUpdated || 0;

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
  updateReadOnlyIndicator
};
