/* ===== Main Application Entry Point ===== */
import { state, initFirebaseSync, updateReadOnlyIndicator } from './state.js';
import { applyCollapses, initUIControls } from './ui.js';
import { loadItems, renderItems, initItemEvents } from './items.js';
import { renderChars, renderCharList, initCharacterEvents } from './characters.js';
import { initExportImportEvents } from './export-import.js';

// Initialize the application
function initApp() {
  // Apply UI states
  applyCollapses();
  
  // Initialize all event listeners
  initUIControls();
  initItemEvents();
  initCharacterEvents();
  initExportImportEvents();
  
  // Initial render
  renderCharList();
  renderChars();
  loadItems(); // async; will call renderItems() when done
  
  // Initialize Firebase real-time sync
  initFirebaseSync();
  
  // Initialize read-only indicator
  updateReadOnlyIndicator();
  
  // Listen for sync events from Firebase to update UI
  document.addEventListener('state-sync', () => {
    console.log("Received sync from another user, updating UI...");
    renderItems();
    renderChars();
    renderCharList();
  });
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
