import { state, saveState, enableWrites } from '../state.js';
import { $, slotsFromSTR } from '../helpers.js';
import { renderChars } from './render.js';
import { renderCharList } from './list.js';

function initCharacterEvents() {
  // Add character button
  $("#addChar")?.addEventListener("click", () => {
    enableWrites(); // Enable writes on character add
    const name = $("#name").value.trim() || "Unnamed";
    const str = Math.max(1, Math.floor(Number($("#str").value || 18)));
    const nSlots = slotsFromSTR(str);
    const equipped = Array(9).fill(null);
    const backpack = Array.from({length: nSlots}, () => null);
    state.chars.push({ name, str, equipped, backpack });
    const idx = state.chars.length - 1;
    state.ui.selectedChar = idx;
    saveState(idx);
    renderChars();
    renderCharList();
    $("#name").value = "";
    $("#str").value = 18;
  });
}

export { initCharacterEvents };
