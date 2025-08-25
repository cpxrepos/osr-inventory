import { state, saveState, enableWrites, setActiveCharIndex } from '../state.js';
import { database, ref, remove } from '../firebase-config.js';
import { $, slotsFromSTR } from '../helpers.js';
import { renderChars } from './render.js';

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

    const isHidden = state.ui.hiddenChars.includes(i);
    const isActive = state.activeCharIndex === i;
    row.className = `char-row${isHidden ? ' char-hidden' : ''}${isActive ? ' active' : ''}`;

    // Only allow dragging the active character
    row.draggable = isActive;
    row.innerHTML = `
      <div>
        <span class="drag-handle">⋮⋮</span>
        <strong>${c.name}</strong>
        <span class="meta">— STR ${c.str}, Slots ${totalSlots}</span>
      </div>
      <div class="char-actions">
        <button class="btn select-btn" data-index="${i}" data-action="select">${isActive ? 'Selected' : 'Select'}</button>
        <button class="icon-btn visibility-btn" data-index="${i}" data-action="toggle-visibility">
          ${isHidden ? '👁️‍🗨️' : '👁️'}
        </button>
        <button class="icon-btn delete-btn" data-index="${i}" data-action="delete">🗑️</button>
      </div>
    `;
    
    // Add drag event handlers
    row.addEventListener("dragstart", (e) => {
      if (!isActive) return;
      e.dataTransfer.setData("text/plain", i.toString());
      row.classList.add("dragging");
    });

    row.addEventListener("dragend", () => {
      if (!isActive) return;
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

      if (
        fromIndex !== toIndex &&
        !isNaN(fromIndex) &&
        fromIndex === state.activeCharIndex &&
        fromIndex >= 0 && fromIndex < state.chars.length
      ) {
        enableWrites(); // Enable writes on character reordering
        const [movedChar] = state.chars.splice(fromIndex, 1);
        state.chars.splice(toIndex, 0, movedChar);
        state.chars.forEach((char, idx) => {
          saveState(`inventory/chars/${idx}`, char);
        });
        setActiveCharIndex(toIndex);
        renderChars();
        renderCharList();
      }
    });
    
    row.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", (e) => {
        const idx = Number(e.currentTarget.dataset.index);
        const action = e.currentTarget.dataset.action;
        if (!Number.isInteger(idx)) return;

        if (action === "select") {
          setActiveCharIndex(idx);
          renderChars();
          renderCharList();
        }
        else if (action === "delete") {
          if (idx !== state.activeCharIndex) return;
          if (confirm(`Delete ${state.chars[idx].name}?`)) {
            enableWrites();
            state.chars.splice(idx, 1);
            remove(ref(database, `inventory/chars/${idx}`));
            state.chars.forEach((char, i) => {
              saveState(`inventory/chars/${i}`, char);
            });
            remove(ref(database, `inventory/chars/${state.chars.length}`));
            if (state.chars.length === 0) {
              setActiveCharIndex(null);
            } else if (state.activeCharIndex === idx) {
              setActiveCharIndex(Math.min(idx, state.chars.length - 1));
            } else if (state.activeCharIndex > idx) {
              setActiveCharIndex(state.activeCharIndex - 1);
            }
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
          saveState('ui/hiddenChars', state.ui.hiddenChars);
          renderChars();
          renderCharList();
        }
      });
    });
    list.appendChild(row);
  });
}

export { renderCharList };
