/* ===== Characters Management ===== */
import { state, saveState } from '../state.js';
import {
  $,
  slotsFromSTR,
  speedFactorFromEmpty,
  fmtSpeed,
  slowdownLabel
} from '../helpers.js';

import { createSlot } from './slot.js';
import { renderCharList } from './list.js';

function renderChar(c, ci, wrap) {
  // Initialize the equipped and backpack arrays if they don't exist
  if (!c.equipped || !Array.isArray(c.equipped)) {
    c.equipped = Array(9).fill(null);
  }

  const backpackSlots = slotsFromSTR(c.str);
  if (!c.backpack || !Array.isArray(c.backpack)) {
    if (Array.isArray(c.slots)) {
      c.backpack = c.slots.slice(0, backpackSlots);
      delete c.slots;
    } else {
      c.backpack = Array(backpackSlots).fill(null);
    }
  }

  if (c.backpack.length !== backpackSlots) {
    const old = c.backpack.slice(0, backpackSlots);
    while (old.length < backpackSlots) old.push(null);
    c.backpack = old;
    saveState(ci);
  }

  c.equipped = c.equipped || [];
  if (c.equipped.length !== 9) {
    const old = c.equipped.slice(0, Math.min(c.equipped.length, 9));
    while (old.length < 9) old.push(null);
    c.equipped = old;
    saveState(ci);
  }

  // Check for sacks in equipped section
  let hasSmallSack = false;
  let hasLargeSack = false;
  for (let i = 0; i < c.equipped.length; i++) {
    const item = c.equipped[i];
    if (item && item.head) {
      if (item.name === "Sack (small)") {
        hasSmallSack = true;
      } else if (item.name === "Sack (large)") {
        hasLargeSack = true;
      }
    }
  }

  if (hasSmallSack && (!c.smallSack || !Array.isArray(c.smallSack))) {
    c.smallSack = Array(9).fill(null);
  }

  if (hasLargeSack && (!c.largeSack || !Array.isArray(c.largeSack))) {
    c.largeSack = Array(backpackSlots).fill(null);
  }

  if (hasLargeSack && c.largeSack.length !== backpackSlots) {
    const old = c.largeSack.slice(0, backpackSlots);
    while (old.length < backpackSlots) old.push(null);
    c.largeSack = old;
    saveState(ci);
  }

  if (hasSmallSack && c.smallSack.length !== 9) {
    const old = c.smallSack.slice(0, 9);
    while (old.length < 9) old.push(null);
    c.smallSack = old;
    saveState(ci);
  }

  // Count occupied slots
  let totalSlots = backpackSlots;
  let totalUsed = c.backpack.filter(x => !!x && (x.head || x.link !== undefined)).length;
  if (hasLargeSack && c.largeSack) {
    totalSlots += backpackSlots;
    totalUsed += c.largeSack.filter(x => !!x && (x.head || x.link !== undefined)).length;
  }

  const empty = totalSlots - totalUsed;
  const backpackFactor = speedFactorFromEmpty(empty);
  let equippedSpeedFactor = 1.0;
  const filledEquippedSlots = c.equipped.filter(slot => slot !== null).length;
  if (filledEquippedSlots >= 8) {
    equippedSpeedFactor = 0.25;
  } else if (filledEquippedSlots >= 6) {
    equippedSpeedFactor = 0.50;
  } else if (filledEquippedSlots >= 4) {
    equippedSpeedFactor = 0.75;
  }
  const factor = Math.min(backpackFactor, equippedSpeedFactor);
  const effFt = Math.max(0, Math.round(120 * factor));

  const charEl = document.createElement('div');
  const isSelected = state.ui.selectedChar === ci;
  charEl.className = 'char' + (isSelected ? ' selected' : ' read-only');

  let encClass = 'enc-good';
  if (empty < 6) encClass = 'enc-warn';
  if (empty < 4) encClass = 'enc-warn';
  if (empty < 2) encClass = 'enc-bad';

  const displaySlots = hasLargeSack ? totalSlots : backpackSlots;

  charEl.innerHTML = `
      <div class="char-header">
        <div class="char-name">${c.name}</div>
      <div class="char-meta">
          <span class="pill">STR ${c.str}</span>
          <span class="pill">Slots ${displaySlots}</span>
          <span class="pill ${encClass}">${slowdownLabel(empty, totalSlots)}</span>
          <span class="pill ${effFt >= 120 ? 'enc-good' : effFt >= 90 ? 'enc-warn' : effFt >= 60 ? 'enc-warn' : 'enc-bad'}">Speed ${fmtSpeed(effFt)}</span>
        </div>
      </div>
    `;

  const inv = document.createElement('div');
  inv.className = 'inv';

  // Equipped section
  const equippedSection = document.createElement('div');
  equippedSection.className = 'inventory-section';
  if (!state.ui.equippedCollapsed) state.ui.equippedCollapsed = [];
  while (state.ui.equippedCollapsed.length <= ci) state.ui.equippedCollapsed.push(false);
  const equippedTitle = document.createElement('div');
  equippedTitle.className = 'section-title';
  equippedTitle.innerHTML = `
      <button class="icon-btn collapse-btn" data-char="${ci}" data-section="equipped">
        ${state.ui.equippedCollapsed[ci] ? '▶' : '▼'}
      </button>
      <span>Equipped</span>
    `;
  equippedSection.appendChild(equippedTitle);
  const equippedCol = document.createElement('div');
  equippedCol.className = 'slots';
  if (state.ui.equippedCollapsed[ci]) equippedCol.style.display = 'none';
  c.equipped.forEach((slotObj, si) => {
    const slot = createSlot(slotObj, ci, si, 'equipped', c.equipped, backpackSlots, renderChars, renderCharList);
    equippedCol.appendChild(slot);
  });
  equippedSection.appendChild(equippedCol);
  inv.appendChild(equippedSection);

  // Backpack section
  const backpackSection = document.createElement('div');
  backpackSection.className = 'inventory-section';
  if (!state.ui.backpackCollapsed) state.ui.backpackCollapsed = [];
  while (state.ui.backpackCollapsed.length <= ci) state.ui.backpackCollapsed.push(false);
  const backpackTitle = document.createElement('div');
  backpackTitle.className = 'section-title';
  backpackTitle.innerHTML = `
      <button class="icon-btn collapse-btn" data-char="${ci}" data-section="backpack">
        ${state.ui.backpackCollapsed[ci] ? '▶' : '▼'}
      </button>
      <span>Backpack</span>
    `;
  backpackSection.appendChild(backpackTitle);
  const backpackCol = document.createElement('div');
  backpackCol.className = 'slots';
  if (state.ui.backpackCollapsed[ci]) backpackCol.style.display = 'none';
  c.backpack.forEach((slotObj, si) => {
    const slot = createSlot(slotObj, ci, si, 'backpack', c.backpack, backpackSlots, renderChars, renderCharList);
    backpackCol.appendChild(slot);
  });
  backpackSection.appendChild(backpackCol);
  inv.appendChild(backpackSection);

  // Add sack sections if equipped
  if (hasLargeSack) {
    const largeSackSection = document.createElement('div');
    largeSackSection.className = 'inventory-section';
    if (!state.ui.largeSackCollapsed) state.ui.largeSackCollapsed = [];
    while (state.ui.largeSackCollapsed.length <= ci) state.ui.largeSackCollapsed.push(false);
    const largeSackTitle = document.createElement('div');
    largeSackTitle.className = 'section-title';
    largeSackTitle.innerHTML = `
        <button class="icon-btn collapse-btn" data-char="${ci}" data-section="largeSack">
          ${state.ui.largeSackCollapsed[ci] ? '▶' : '▼'}
        </button>
        <span>Large Sack</span>
      `;
    largeSackSection.appendChild(largeSackTitle);
    const largeSackCol = document.createElement('div');
    largeSackCol.className = 'slots';
    if (state.ui.largeSackCollapsed[ci]) largeSackCol.style.display = 'none';
    c.largeSack.forEach((slotObj, si) => {
      const slot = createSlot(slotObj, ci, si, 'largeSack', c.largeSack, backpackSlots, renderChars, renderCharList);
      largeSackCol.appendChild(slot);
    });
    largeSackSection.appendChild(largeSackCol);
    inv.appendChild(largeSackSection);
  } else if (hasSmallSack) {
    const smallSackSection = document.createElement('div');
    smallSackSection.className = 'inventory-section';
    if (!state.ui.smallSackCollapsed) state.ui.smallSackCollapsed = [];
    while (state.ui.smallSackCollapsed.length <= ci) state.ui.smallSackCollapsed.push(false);
    const smallSackTitle = document.createElement('div');
    smallSackTitle.className = 'section-title';
    smallSackTitle.innerHTML = `
        <button class="icon-btn collapse-btn" data-char="${ci}" data-section="smallSack">
          ${state.ui.smallSackCollapsed[ci] ? '▶' : '▼'}
        </button>
        <span>Small Sack</span>
      `;
    smallSackSection.appendChild(smallSackTitle);
    const smallSackCol = document.createElement('div');
    smallSackCol.className = 'slots';
    if (state.ui.smallSackCollapsed[ci]) smallSackCol.style.display = 'none';
    c.smallSack.forEach((slotObj, si) => {
      const slot = createSlot(slotObj, ci, si, 'smallSack', c.smallSack, backpackSlots, renderChars, renderCharList);
      smallSackCol.appendChild(slot);
    });
    smallSackSection.appendChild(smallSackCol);
    inv.appendChild(smallSackSection);
  }

  charEl.querySelectorAll('.collapse-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const charIndex = parseInt(e.currentTarget.dataset.char, 10);
      const section = e.currentTarget.dataset.section;
      if (section === 'equipped') {
        state.ui.equippedCollapsed[charIndex] = !state.ui.equippedCollapsed[charIndex];
      } else if (section === 'backpack') {
        state.ui.backpackCollapsed[charIndex] = !state.ui.backpackCollapsed[charIndex];
      } else if (section === 'largeSack') {
        state.ui.largeSackCollapsed[charIndex] = !state.ui.largeSackCollapsed[charIndex];
      } else if (section === 'smallSack') {
        state.ui.smallSackCollapsed[charIndex] = !state.ui.smallSackCollapsed[charIndex];
      }
      saveState(charIndex);
      renderChars();
    });
  });

  charEl.appendChild(inv);
  wrap.appendChild(charEl);
}

// Render characters in the center panel
function renderChars() {
  const wrap = $("#chars");
  if (!wrap) return;
  wrap.innerHTML = "";

  if (!Array.isArray(state.ui.hiddenChars)) {
    state.ui.hiddenChars = [];
  }

  if (state.chars.length === 0) {
    const p = document.createElement("div");
    p.className = "small";
    p.textContent = "No characters yet. Add one above.";
    wrap.appendChild(p);
    return;
  }

  state.chars.forEach((c, ci) => {
    if (state.ui.hiddenChars.includes(ci)) return;
    renderChar(c, ci, wrap);
  });
}

export { renderChars };
