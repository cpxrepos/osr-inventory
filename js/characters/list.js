import { state, saveState, enableWrites } from '../state.js';
import { $, slotsFromSTR } from '../helpers.js';
import { renderChars } from './render.js';
import { database, ref, set } from '../firebase-config.js';

function renderCharList() {
  const list = $("#charList"); 
  if (!list) return;
  list.innerHTML = "";
  
  if (state.chars.length === 0) {
    const p = document.createElement("div");
    p.className = "small";
    p.textContent = "No characters yet. Add one above.";
    list.appendChild(p);
    return;
  }
  
  state.chars.forEach((c, i) => {
    const totalSlots = slotsFromSTR(c.str);
    const row = document.createElement("div");
    
    // Initialize hiddenChars array if it doesn't exist
    if (!Array.isArray(state.ui.hiddenChars)) {
      state.ui.hiddenChars = [];
    }
    
    // Add hidden class if character is hidden
    const isHidden = state.ui.hiddenChars.includes(i);
    const isSelected = state.ui.selectedChar === i;
    row.className = `char-row${isHidden ? ' hidden-char' : ''}${isSelected ? ' selected' : ''}`;
    
    // Add draggable attribute to enable drag functionality
    row.draggable = true;
    row.innerHTML = `
      <div>
        <span class="drag-handle">⋮⋮</span>
        <strong>${c.name}</strong>
        <span class="meta">— STR ${c.str}, Slots ${totalSlots}</span>
      </div>
      <div class="char-actions">
        <button class="icon-btn visibility-btn" data-index="${i}" data-action="toggle-visibility">
          ${isHidden ? '👁️‍🗨️' : '👁️'}
        </button>
        <button class="icon-btn delete-btn" data-index="${i}" data-action="delete">🗑️</button>
      </div>
    `;
    
    // Add drag event handlers
    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", i.toString());
      row.classList.add("dragging");
    });
    
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
    });
    
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("drag-over");
    });
    
    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-over");
    });
    
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      
      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
      const toIndex = i;
      
      if (fromIndex !== toIndex && !isNaN(fromIndex) && fromIndex >= 0 && fromIndex < state.chars.length) {
        enableWrites(); // Enable writes on character reordering
        const selectedId = state.chars[state.ui.selectedChar]?.id;
        // Reorder the characters array
        const [movedChar] = state.chars.splice(fromIndex, 1);
        state.chars.splice(toIndex, 0, movedChar);
        state.chars.forEach((char, idx) => {
          if (char.id === selectedId) state.ui.selectedChar = idx;
          saveState(idx);
        });
        renderChars();
        renderCharList();
      }
    });

    row.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", (e) => {
        const idx = Number(e.currentTarget.dataset.index);
        const action = e.currentTarget.dataset.action;
        if (!Number.isInteger(idx)) return;
        
        if (action === "delete") {
          if (confirm(`Delete ${state.chars[idx].name}?`)) {
            enableWrites();
            const [removed] = state.chars.splice(idx, 1);
            if (removed && removed.id) {
              set(ref(database, `inventory/chars/${removed.id}`), null);
            }
            if (state.ui.selectedChar === idx) {
              state.ui.selectedChar = null;
            } else if (state.ui.selectedChar > idx) {
              state.ui.selectedChar--;
            }
            state.chars.forEach((_, i2) => saveState(i2));
            renderChars();
            renderCharList();
          }
        }
        else if (action === "toggle-visibility") {
          enableWrites();
          const hiddenIndex = state.ui.hiddenChars.indexOf(idx);
          if (hiddenIndex >= 0) {
            // Character is currently hidden, unhide it
            state.ui.hiddenChars.splice(hiddenIndex, 1);
          } else {
            // Character is currently visible, hide it
            state.ui.hiddenChars.push(idx);
          }
          saveState();
          renderChars();
          renderCharList();
        }
      });
    });

    // Select character on row click (excluding button clicks)
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      state.ui.selectedChar = i;
      renderChars();
      renderCharList();
    });
    list.appendChild(row);
  });
}

export { renderCharList };
