/* ===== State & Persistence ===== */
import {
  database,
  ref,
  onValue,
  set,
  get,
  sessionId
} from './firebase-config.js';

// Initialize state with defaults
const state = {
  items: [],              // loaded from items.json
  chars: [],
  ui: {
    leftCollapsed: false,
    rightCollapsed: false,
    hiddenChars: [],       // Track which characters are hidden
    selectedChar: null,    // Currently selected character index
    expandedCoinPurses: {} // Track expanded coin purses locally
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
  Object.assign(state, localState);
}
// Ensure expandedCoinPurses exists after loading
if (!state.ui.expandedCoinPurses) {
  state.ui.expandedCoinPurses = {};
}

// Flag to prevent sync loops
let isSyncing = false;

// Generate simple unique IDs when needed
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Save state to local storage and Firebase
function saveState(charIndex) {
  // Always save to localStorage for quick loading next time
  localStorage.setItem("inv_external_items_v5", JSON.stringify(state));

  // Don't sync to Firebase if we're currently processing a sync from Firebase
  // or if we're in read-only mode and haven't had user interaction yet
  if (isSyncing || state.readOnlyMode) return;

  // If a specific character index is provided, only update that character
  if (typeof charIndex === 'number') {
    const c = state.chars[charIndex];
    if (!c) return;

    // Ensure the character has an ID
    if (!c.id) c.id = genId();

    const charRef = ref(database, `inventory/chars/${c.id}`);
    get(charRef).then((snap) => {
      const data = snap.val();
      if (data && data.lastUpdated && data.lastUpdated !== c.lastUpdated) {
        console.warn(`${c.name} has newer data on the server. Please reload before saving.`);
        return;
      }
      // Create a sanitized copy without local UI-only properties
      const sanitized = JSON.parse(JSON.stringify(c));
      ['equipped', 'backpack', 'largeSack', 'smallSack'].forEach(sec => {
        if (Array.isArray(sanitized[sec])) {
          sanitized[sec] = sanitized[sec].map(slot => {
            if (slot && typeof slot === 'object') {
              const { expanded, ...rest } = slot;
              return rest;
            }
            return slot;
          });
        }
      });

      const payload = {
        ...sanitized,
        order: charIndex,
        lastUpdated: Date.now(),
        lastUpdatedBy: sessionId
      };
      set(charRef, payload);
      c.lastUpdated = payload.lastUpdated;
    });
  } else {
    // Global save (items, etc.)
    set(ref(database, 'inventory/items'), {
      items: state.items,
      lastUpdated: Date.now(),
      lastUpdatedBy: sessionId
    });
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
  // Listen for item changes
  const itemsRef = ref(database, 'inventory/items');
  onValue(itemsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data || data.lastUpdatedBy === sessionId) return;

    isSyncing = true;
    state.items = data.items || [];
    localStorage.setItem("inv_external_items_v5", JSON.stringify(state));
    const syncEvent = new CustomEvent('state-sync', { detail: { source: 'firebase' } });
    document.dispatchEvent(syncEvent);
    isSyncing = false;
  });

  // Listen for character changes
  const charsRef = ref(database, 'inventory/chars');
  onValue(charsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    isSyncing = true;
    const arr = Object.entries(data).map(([id, c]) => ({ ...c, id })).sort((a, b) => (a.order || 0) - (b.order || 0));
    state.chars = arr;
    localStorage.setItem("inv_external_items_v5", JSON.stringify(state));
    const syncEvent = new CustomEvent('state-sync', { detail: { source: 'firebase' } });
    document.dispatchEvent(syncEvent);
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
