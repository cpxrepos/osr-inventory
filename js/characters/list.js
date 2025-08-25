import { state, saveState, enableWrites, toggleCharSelection } from '../state.js';
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
    const isSelected = state.selectedCharIndices.includes(i);
    row.className = `char-row${isHidden ? ' char-hidden' : ''}${isSelected ? ' active' : ''}`;

    row.innerHTML = `
      <div>
        <strong>${c.name}</strong>
        <span class="meta">— STR ${c.str}, Slots ${totalSlots}</span>
      </div>
      <div class="char-actions">
        <button class="btn select-btn" data-index="${i}" data-action="select">${isSelected ? 'Selected' : 'Select'}</button>
        <button class="icon-btn visibility-btn" data-index="${i}" data-action="toggle-visibility">
          ${isHidden ? '👁️‍🗨️' : '👁️'}
        </button>
        <button class="icon-btn delete-btn" data-index="${i}" data-action="delete">🗑️</button>
      </div>
    `;
    
    row.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", (e) => {
        const idx = Number(e.currentTarget.dataset.index);
        const action = e.currentTarget.dataset.action;
        if (!Number.isInteger(idx)) return;

        if (action === "select") {
          toggleCharSelection(idx);
          renderChars();
          renderCharList();
        }
        else if (action === "delete") {
          if (!state.selectedCharIndices.includes(idx)) return;
          if (confirm(`Delete ${state.chars[idx].name}?`)) {
            enableWrites();
            state.chars.splice(idx, 1);
            remove(ref(database, `inventory/chars/${idx}`));
            state.chars.forEach((char, i) => {
              saveState(`inventory/chars/${i}`, char);
            });
            remove(ref(database, `inventory/chars/${state.chars.length}`));
            const pos = state.selectedCharIndices.indexOf(idx);
            if (pos >= 0) state.selectedCharIndices.splice(pos, 1);
            state.selectedCharIndices = state.selectedCharIndices.map(ci => ci > idx ? ci - 1 : ci);
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
