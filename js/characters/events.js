import { state, saveState, enableWrites, toggleCharSelection } from '../state.js';
import { $, slotsFromSTR } from '../helpers.js';
import { renderChars } from './render.js';
import { ensureBeltPouch } from './belt-pouch.js';
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
    const newChar = { name, str, equipped, backpack, notes: "" };
    ensureBeltPouch(newChar);
    state.chars.push(newChar);
    const newIndex = state.chars.length - 1;
    saveState(`inventory/chars/${newIndex}`, state.chars[newIndex]);
    toggleCharSelection(newIndex);
    renderChars();
    renderCharList();
    $("#name").value = "";
    $("#str").value = 18;
  });
}

export { initCharacterEvents };
