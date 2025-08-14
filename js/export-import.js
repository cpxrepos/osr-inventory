/* ===== Export/Import Functionality ===== */
import { state, saveState } from './state.js';
import { $ } from './helpers.js';
import { renderItems } from './items.js';
import { renderChars, renderCharList } from './characters.js';
import { applyCollapses } from './ui.js';

// Export the current character and inventory data to a JSON file
function exportData() {
  const data = JSON.stringify({
    chars: state.chars,
    items: state.items
  }, null, 2);
  
  const blob = new Blob([data], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); 
  a.href = url; 
  a.download = "character_data.json"; 
  a.click();
  URL.revokeObjectURL(url);
}

// Import character and inventory data from a JSON file
function importData() {
  const input = document.createElement("input");
  input.type = "file"; 
  input.accept = "application/json";
  
  input.onchange = e => {
    const file = e.target.files[0]; 
    if (!file) return;
    
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const obj = JSON.parse(fr.result);
        if (!obj || typeof obj !== "object" || !Array.isArray(obj.items) || !Array.isArray(obj.chars)) throw 0;
        
        // Replace current inventory and character data with imported data
        state.chars = obj.chars;
        state.items = obj.items;
        saveState();
        
        // Update all UI components
        renderItems();
        renderChars();
        renderCharList();
        applyCollapses();
        alert("Character and inventory data imported successfully!");
      } catch { 
        alert("Invalid data file."); 
      }
    };
    fr.readAsText(file);
  };
  
  input.click();
}


// Initialize export/import event listeners
function initExportImportEvents() {
  $("#exportDataBtn")?.addEventListener("click", exportData);
  $("#importDataBtn")?.addEventListener("click", importData);
}

export {
  exportData,
  importData,
  initExportImportEvents
};
