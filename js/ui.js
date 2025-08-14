/* ===== UI Controls ===== */
import { state, saveState } from './state.js';
import { $ } from './helpers.js';

// Apply panel collapse states from UI
function applyCollapses() {
  const left = $("#leftPane");
  const right = $("#rightPane");
  
  left.classList.toggle("collapsed", state.ui.leftCollapsed);
  right.classList.toggle("collapsed", state.ui.rightCollapsed);
  
  $("#toggleLeft").textContent = state.ui.leftCollapsed ? "Expand" : "Collapse";
  $("#toggleRight").textContent = state.ui.rightCollapsed ? "Expand" : "Collapse";
  
  $("#toggleLeft").setAttribute("aria-expanded", String(!state.ui.leftCollapsed));
  $("#toggleRight").setAttribute("aria-expanded", String(!state.ui.rightCollapsed));
  
  document.documentElement.style.setProperty('--left', state.ui.leftCollapsed ? '36px' : '320px');
  document.documentElement.style.setProperty('--right', state.ui.rightCollapsed ? '36px' : '320px');
}

// Initialize UI event listeners
function initUIControls() {
  // Panel collapse toggles
  $("#toggleLeft").addEventListener("click", () => { 
    state.ui.leftCollapsed = !state.ui.leftCollapsed; 
    saveState(); 
    applyCollapses(); 
  });
  
  $("#toggleRight").addEventListener("click", () => { 
    state.ui.rightCollapsed = !state.ui.rightCollapsed; 
    saveState(); 
    applyCollapses(); 
  });
}

export {
  applyCollapses,
  initUIControls
};
