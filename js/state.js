/* ===== State & Persistence ===== */
import {
  database,
  ref,
  onValue,
  set,
  update,
  push,
  serverTimestamp,
  sessionId,
  get
} from './firebase-config.js';

// Initialize state with defaults
const state = {
  items: {},              // loaded from database
  chars: [],
  selectedCharIndices: [],  // which characters are currently editable
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
  if (!Array.isArray(state.selectedCharIndices)) {
    state.selectedCharIndices = [];
    if (typeof localState.activeCharIndex === 'number') {
      state.selectedCharIndices = [localState.activeCharIndex];
    }
  }
}

// Remove any legacy "expanded" flags from coin purses
function removeExpandedFlags() {
  state.chars.forEach(char => {
    ['equipped', 'backpack', 'smallSack', 'largeSack'].forEach(section => {
      const arr = char[section];
      if (!Array.isArray(arr)) return;
      arr.forEach(slot => {
        if (slot && typeof slot === 'object' && 'expanded' in slot) {
          delete slot.expanded;
        }
      });
    });
  });
}

removeExpandedFlags();

// Flag to prevent sync loops
let isSyncing = false;

// Track last update timestamp from Firebase
let lastInventoryUpdate = 0;

// Track which characters are currently selected for editing
function toggleCharSelection(idx) {
  const arr = state.selectedCharIndices;
  const pos = arr.indexOf(idx);
  if (pos >= 0) {
    arr.splice(pos, 1);
  } else {
    arr.push(idx);
  }
  localStorage.setItem("inv_external_items_v5", JSON.stringify(state));
}

function getSelectedCharIndices() {
  return state.selectedCharIndices;
}

// Save state to local storage and Firebase
async function saveState(path = null, value) {
  // Clean up any UI-only flags before persisting
  removeExpandedFlags();

  // Always save to localStorage for quick loading next time
  localStorage.setItem("inv_external_items_v5", JSON.stringify(state));

  // Don't sync to Firebase if we're currently processing a sync from Firebase
  // or if we're in read-only mode and haven't had user interaction yet
  if (isSyncing || state.readOnlyMode) return;

  if (path) {
    if (path.startsWith('inventory/')) {
      // Backup the current state before applying an inventory update
      push(ref(database, 'inventory/history'), {
        chars: state.chars,
        timestamp: serverTimestamp(),
        sessionId
      });

      // Update the specific inventory path with metadata
      const inventoryRef = ref(database, 'inventory');
      const updates = {
        [path.replace('inventory/', '')]: value,
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: sessionId
      };
      await update(inventoryRef, updates);
    } else {
      // For all other paths just set the value directly
      await set(ref(database, path), value);
    }
    return;
  }

  // Backup current state before saving
  push(ref(database, 'inventory/history'), {
    chars: state.chars,
    timestamp: serverTimestamp(),
    sessionId
  });

  const inventoryRef = ref(database, 'inventory');

  try {
    const snapshot = await get(inventoryRef);
    const data = snapshot.val();
    if (
      data &&
      typeof data.lastUpdated === 'number' &&
      data.lastUpdated > lastInventoryUpdate
    ) {
      isSyncing = true;
      state.chars = data.chars || [];
      if (typeof data.lastUpdated === 'number') {
        lastInventoryUpdate = data.lastUpdated;
      }
      localStorage.setItem("inv_external_items_v5", JSON.stringify(state));
      const syncEvent = new CustomEvent('state-sync', { detail: { source: 'firebase' } });
      document.dispatchEvent(syncEvent);
      isSyncing = false;
      return;
    }

    await update(inventoryRef, {
      chars: state.chars,
      lastUpdated: serverTimestamp(),
      lastUpdatedBy: sessionId
    });
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
    
    // Skip if this update was triggered by the current session
    if (data.lastUpdatedBy === sessionId) {
      if (typeof data.lastUpdated === 'number') {
        lastInventoryUpdate = data.lastUpdated;
      }
      return;
    }

    // Ignore outdated updates
    if (
      typeof data.lastUpdated === 'number' &&
      lastInventoryUpdate &&
      data.lastUpdated <= lastInventoryUpdate
    ) {
      return;
    }
    
    // Flag that we're syncing to prevent loops
    isSyncing = true;
    
    // Update local state
    state.chars = data.chars || [];

    // Strip any persisted expanded flags
    removeExpandedFlags();

    if (typeof data.lastUpdated === 'number') {
      lastInventoryUpdate = data.lastUpdated;
    }
    
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
  toggleCharSelection,
  getSelectedCharIndices
};
