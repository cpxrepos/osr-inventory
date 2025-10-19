/* ===== Characters Management ===== */
import { state, saveState, enableWrites } from '../state.js';
import {
  $,
  slotsFromSTR,
  speedFactorFromEmpty,
  fmtSpeed,
  slowdownLabel
} from '../helpers.js';

import { ensureBeltPouch } from './belt-pouch.js';

import { createSlot } from './slot.js';
import { renderCharList } from './list.js';

const COIN_CONVERSION_TO_GP = {
  PP: 5,
  GP: 1,
  EP: 0.5,
  SP: 0.1,
  CP: 0.01,
  Gems: 1
};

const COIN_SECTIONS = ['beltPouch', 'equipped', 'backpack', 'smallSack', 'largeSack'];

function calculateCoinValueInGP(char) {
  let totalValue = 0;

  COIN_SECTIONS.forEach(section => {
    const slots = char[section];
    if (!Array.isArray(slots)) return;

    slots.forEach(slot => {
      if (!slot || !slot.head) return;

      const isCoinContainer = slot.hasCoinSlots || (slot.name && slot.name.toLowerCase().includes('coin'));
      if (!isCoinContainer) return;

      const coinAmounts = slot.coinAmounts || {};
      let entries = Object.entries(coinAmounts);

      if (!entries.length && Array.isArray(slot.coinTypes)) {
        entries = slot.coinTypes.map(type => [type, 0]);
      }

      entries.forEach(([type, rawAmount]) => {
        const amount = Number(rawAmount) || 0;
        if (!amount) return;

        const gpFactor = COIN_CONVERSION_TO_GP[type] ?? 1;
        totalValue += amount * gpFactor;
      });
    });
  });

  return totalValue;
}

function formatCoinValue(value) {
  if (!Number.isFinite(value)) return '0';

  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return rounded.toFixed(2);
}

// Render characters in the center panel
function renderChars() {
  const wrap = $("#chars");
  if (!wrap) return;
  wrap.innerHTML = "";

  // Initialize hiddenChars array if it doesn't exist
  if (!Array.isArray(state.ui.hiddenChars)) {
    state.ui.hiddenChars = [];
  }

  state.chars.forEach((c, ci) => {
    // Skip rendering if character is hidden
    if (state.ui.hiddenChars.includes(ci)) {
      return;
    }
    const isActive = state.selectedCharIndices.includes(ci);
    // Initialize the equipped and backpack arrays if they don't exist
    if (!c.equipped || !Array.isArray(c.equipped)) {
      c.equipped = Array(9).fill(null);
    }
    
    const backpackSlots = slotsFromSTR(c.str);
    if (!c.backpack || !Array.isArray(c.backpack)) {
      // If migrating from old format, transfer items to backpack
      if (Array.isArray(c.slots)) {
        c.backpack = c.slots.slice(0, backpackSlots);
        delete c.slots; // Remove old slots array
      } else {
        c.backpack = Array(backpackSlots).fill(null);
      }
    }

    // Ensure backpack array size matches STR rule
    if (c.backpack.length !== backpackSlots) {
      const old = c.backpack.slice(0, backpackSlots);
      while (old.length < backpackSlots) old.push(null);
      c.backpack = old;
      saveState(`inventory/chars/${ci}/backpack`, c.backpack);
    }

    // FIXED: Ensure equipped array is ALWAYS exactly 9 slots regardless of STR
    // This fixes an issue where some characters might have less than 9 equipped slots
    c.equipped = c.equipped || [];
    if (c.equipped.length !== 9) {
      const old = c.equipped.slice(0, Math.min(c.equipped.length, 9));
      while (old.length < 9) old.push(null);
      c.equipped = old;
      saveState(`inventory/chars/${ci}/equipped`, c.equipped);
    }
    
    // Ensure belt pouch slot exists and is initialized
    const beltPouchChanged = ensureBeltPouch(c);
    if (beltPouchChanged) {
      saveState(`inventory/chars/${ci}/beltPouch`, c.beltPouch);
    }

    // Initialize notes field if missing
    if (typeof c.notes !== "string") {
      c.notes = "";
      saveState(`inventory/chars/${ci}/notes`, c.notes);
    }

    // Check for sacks in equipped section
    let hasSmallSack = false;
    let hasLargeSack = false;
    
    // Look for sacks in equipped slots
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
    
    // Initialize sack arrays if needed
    if (hasSmallSack && (!c.smallSack || !Array.isArray(c.smallSack))) {
      c.smallSack = Array(9).fill(null);
    }
    
    if (hasLargeSack && (!c.largeSack || !Array.isArray(c.largeSack))) {
      c.largeSack = Array(backpackSlots).fill(null);
    }
    
    // Ensure sack arrays have the correct size
    if (hasLargeSack && c.largeSack.length !== backpackSlots) {
      const old = c.largeSack.slice(0, backpackSlots);
      while (old.length < backpackSlots) old.push(null);
      c.largeSack = old;
      saveState(`inventory/chars/${ci}/largeSack`, c.largeSack);
    }
    
    if (hasSmallSack && c.smallSack.length !== 9) {
      const old = c.smallSack.slice(0, 9);
      while (old.length < 9) old.push(null);
      c.smallSack = old;
      saveState(`inventory/chars/${ci}/smallSack`, c.smallSack);
    }

    // Count occupied slots in backpack and large sack (if equipped)
    let totalSlots = backpackSlots;
    let totalUsed = c.backpack.filter(x => !!x && (x.head || x.link !== undefined)).length;
    
    // Include large sack in encumbrance calculation if equipped
    if (hasLargeSack && c.largeSack) {
      totalSlots += backpackSlots; // Large sack has same capacity as backpack
      totalUsed += c.largeSack.filter(x => !!x && (x.head || x.link !== undefined)).length;
    }
    
    const empty = totalSlots - totalUsed;
    
    // Calculate backpack encumbrance factor
    const backpackFactor = speedFactorFromEmpty(empty);
    
    // Calculate equipped-based speed penalties
    let equippedSpeedFactor = 1.0; // Default is 100% speed (120')
    
    // Count filled equipped slots from top down
    const filledEquippedSlots = c.equipped.filter(slot => slot !== null).length;
    
    // Apply speed penalties based on filled equipped slots
    if (filledEquippedSlots >= 8) {
      equippedSpeedFactor = 0.25; // 8-9 slots = speed 30
    } else if (filledEquippedSlots >= 6) {
      equippedSpeedFactor = 0.50; // 6-7 slots = speed 60
    } else if (filledEquippedSlots >= 4) {
      equippedSpeedFactor = 0.75; // 4-5 slots = speed 90
    } // 1-3 slots = speed 120 (no penalty, equippedSpeedFactor remains 1.0)
    
    // Use the more restrictive of the two factors
    const factor = Math.min(backpackFactor, equippedSpeedFactor);
    const effFt = Math.max(0, Math.round(120 * factor)); // fixed base speed

    const totalCoinValueGP = calculateCoinValueInGP(c);
    const formattedCoinValue = formatCoinValue(totalCoinValueGP);

    const charEl = document.createElement("div");
    charEl.className = "char";

    let encClass = "enc-good";
    if (empty < 6) encClass = "enc-warn";
    if (empty < 4) encClass = "enc-warn";
    if (empty < 2) encClass = "enc-bad";

    // Display slots that include large sack if equipped
    const displaySlots = hasLargeSack ? totalSlots : backpackSlots;
    
    charEl.innerHTML = `
      <div class="char-header">
        <div class="char-name">${c.name}</div>
      <div class="char-meta">
          <span class="pill">STR ${c.str}</span>
          <span class="pill">Slots ${displaySlots}</span>
          <span class="pill coin-pill">Coins ${formattedCoinValue} GP</span>
          <span class="pill ${encClass}">${slowdownLabel(empty, totalSlots)}</span>
          <span class="pill ${effFt >= 120 ? 'enc-good' : effFt >= 90 ? 'enc-warn' : effFt >= 60 ? 'enc-warn' : 'enc-bad'}">Speed ${fmtSpeed(effFt)}</span>
        </div>
      </div>
    `;

    const inv = document.createElement("div");
    inv.className = "inv";

    // Equipped section
    const equippedSection = document.createElement("div");
    equippedSection.className = "inventory-section";
    
    // Initialize equipped collapse state in state if it doesn't exist
    if (!state.ui.equippedCollapsed) {
      state.ui.equippedCollapsed = [];
    }
    
    // Ensure array is large enough for this character
    while (state.ui.equippedCollapsed.length <= ci) {
      state.ui.equippedCollapsed.push(false);
    }
    
    const equippedTitle = document.createElement("div");
    equippedTitle.className = "section-title";
    
    // Create title with arrow collapse button on the left
    equippedTitle.innerHTML = `
      <button class="icon-btn collapse-btn" data-char="${ci}" data-section="equipped">
        ${state.ui.equippedCollapsed[ci] ? "▶" : "▼"}
      </button>
      <span>Equipped</span>
    `;
    equippedSection.appendChild(equippedTitle);
    
    const equippedCol = document.createElement("div");
    equippedCol.className = "slots";
    
    // Apply collapsed state if needed
    if (state.ui.equippedCollapsed[ci]) {
      equippedCol.style.display = "none";
    }
    
    // Render equipped slots (use a standard loop to handle sparse arrays from Firebase)
    for (let si = 0; si < c.equipped.length; si++) {
      const slotObj = c.equipped[si];
      const slot = createSlot(slotObj, ci, si, "equipped", c.equipped, backpackSlots, renderChars, renderCharList);
      equippedCol.appendChild(slot);
    }
    
    equippedSection.appendChild(equippedCol);
    inv.appendChild(equippedSection);

    // Belt pouch section (always a single dedicated coin purse slot)
    const beltSection = document.createElement("div");
    beltSection.className = "inventory-section";

    const beltTitle = document.createElement("div");
    beltTitle.className = "section-title";
    beltTitle.innerHTML = `<span>Belt Pouch</span>`;
    beltSection.appendChild(beltTitle);

    const beltCol = document.createElement("div");
    beltCol.className = "slots";
    const beltSlot = createSlot(c.beltPouch[0], ci, 0, "beltPouch", c.beltPouch, 1, renderChars, renderCharList);
    beltCol.appendChild(beltSlot);
    beltSection.appendChild(beltCol);
    inv.appendChild(beltSection);

    // Backpack section
    const backpackSection = document.createElement("div");
    backpackSection.className = "inventory-section";
    
    // Initialize backpack collapse state in state if it doesn't exist
    if (!state.ui.backpackCollapsed) {
      state.ui.backpackCollapsed = [];
    }
    
    // Ensure array is large enough for this character
    while (state.ui.backpackCollapsed.length <= ci) {
      state.ui.backpackCollapsed.push(false);
    }
    
    const backpackTitle = document.createElement("div");
    backpackTitle.className = "section-title";
    
    // Create title with arrow collapse button on the left
    backpackTitle.innerHTML = `
      <button class="icon-btn collapse-btn" data-char="${ci}" data-section="backpack">
        ${state.ui.backpackCollapsed[ci] ? "▶" : "▼"}
      </button>
      <span>Backpack</span>
    `;
    backpackSection.appendChild(backpackTitle);
    
    const backpackCol = document.createElement("div");
    backpackCol.className = "slots";
    
    // Apply collapsed state if needed
    if (state.ui.backpackCollapsed[ci]) {
      backpackCol.style.display = "none";
    }

    // Create a helper function for creating slot elements

    // Render backpack slots (standard loop for sparse arrays)
    for (let si = 0; si < c.backpack.length; si++) {
      const slotObj = c.backpack[si];
      const slot = createSlot(slotObj, ci, si, "backpack", c.backpack, backpackSlots, renderChars, renderCharList);
      backpackCol.appendChild(slot);
    }

    backpackSection.appendChild(backpackCol);
    inv.appendChild(backpackSection);
    
    // Add sack sections if equipped
    // Check for large sack first (takes priority)
    if (hasLargeSack) {
      const largeSackSection = document.createElement("div");
      largeSackSection.className = "inventory-section";
      
      // Initialize large sack collapse state in state if it doesn't exist
      if (!state.ui.largeSackCollapsed) {
        state.ui.largeSackCollapsed = [];
      }
      
      // Ensure array is large enough for this character
      while (state.ui.largeSackCollapsed.length <= ci) {
        state.ui.largeSackCollapsed.push(false);
      }
      
      const largeSackTitle = document.createElement("div");
      largeSackTitle.className = "section-title";
      
      // Create title with arrow collapse button on the left
      largeSackTitle.innerHTML = `
        <button class="icon-btn collapse-btn" data-char="${ci}" data-section="largeSack">
          ${state.ui.largeSackCollapsed[ci] ? "▶" : "▼"}
        </button>
        <span>Large Sack</span>
      `;
      largeSackSection.appendChild(largeSackTitle);
      
      const largeSackCol = document.createElement("div");
      largeSackCol.className = "slots";
      
      // Apply collapsed state if needed
      if (state.ui.largeSackCollapsed[ci]) {
        largeSackCol.style.display = "none";
      }
      
      // Render large sack slots (standard loop for sparse arrays)
      for (let si = 0; si < c.largeSack.length; si++) {
        const slotObj = c.largeSack[si];
        const slot = createSlot(slotObj, ci, si, "largeSack", c.largeSack, backpackSlots, renderChars, renderCharList);
        largeSackCol.appendChild(slot);
      }
      
      largeSackSection.appendChild(largeSackCol);
      inv.appendChild(largeSackSection);
    }
    // If no large sack but small sack is equipped
    else if (hasSmallSack) {
      const smallSackSection = document.createElement("div");
      smallSackSection.className = "inventory-section";
      
      // Initialize small sack collapse state in state if it doesn't exist
      if (!state.ui.smallSackCollapsed) {
        state.ui.smallSackCollapsed = [];
      }
      
      // Ensure array is large enough for this character
      while (state.ui.smallSackCollapsed.length <= ci) {
        state.ui.smallSackCollapsed.push(false);
      }
      
      const smallSackTitle = document.createElement("div");
      smallSackTitle.className = "section-title";
      
      // Create title with arrow collapse button on the left
      smallSackTitle.innerHTML = `
        <button class="icon-btn collapse-btn" data-char="${ci}" data-section="smallSack">
          ${state.ui.smallSackCollapsed[ci] ? "▶" : "▼"}
        </button>
        <span>Small Sack</span>
      `;
      smallSackSection.appendChild(smallSackTitle);
      
      const smallSackCol = document.createElement("div");
      smallSackCol.className = "slots";
      
      // Apply collapsed state if needed
      if (state.ui.smallSackCollapsed[ci]) {
        smallSackCol.style.display = "none";
      }
      
      // Render small sack slots (standard loop for sparse arrays)
      for (let si = 0; si < c.smallSack.length; si++) {
        const slotObj = c.smallSack[si];
        const slot = createSlot(slotObj, ci, si, "smallSack", c.smallSack, backpackSlots, renderChars, renderCharList);
        smallSackCol.appendChild(slot);
      }
      
      smallSackSection.appendChild(smallSackCol);
      inv.appendChild(smallSackSection);
    }
    
    // Notes section
    const notesSection = document.createElement("div");
    notesSection.className = "inventory-section";

    const notesHeader = document.createElement("div");
    notesHeader.className = "section-title";

    const notesTitle = document.createElement("span");
    notesTitle.textContent = "Notes";
    notesHeader.appendChild(notesTitle);

    const saveNotesBtn = document.createElement("button");
    saveNotesBtn.className = "btn";
    saveNotesBtn.textContent = "Save";
    if (!isActive) {
      saveNotesBtn.disabled = true;
      saveNotesBtn.style.display = "none";
    }
    saveNotesBtn.addEventListener("click", () => {
      enableWrites();
      saveState(`inventory/chars/${ci}/notes`, c.notes);
    });
    notesHeader.appendChild(saveNotesBtn);

    notesSection.appendChild(notesHeader);

    const notesArea = document.createElement("textarea");
    notesArea.className = "notes-textarea";
    notesArea.placeholder = "Add notes...";
    notesArea.value = c.notes;

    if (isActive) {
      notesArea.addEventListener("input", () => {
        c.notes = notesArea.value;
      });
    } else {
      notesArea.disabled = true;
    }

    notesSection.appendChild(notesArea);
    inv.appendChild(notesSection);

    // Add event listeners for collapse buttons
    charEl.querySelectorAll('.collapse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Use currentTarget instead of target to ensure we get the button element
        // even if a child element within the button was clicked
        const charIndex = parseInt(e.currentTarget.dataset.char, 10);
        const section = e.currentTarget.dataset.section;
        
        // Toggle the collapsed state
        if (section === 'equipped') {
          state.ui.equippedCollapsed[charIndex] = !state.ui.equippedCollapsed[charIndex];
        } else if (section === 'backpack') {
          state.ui.backpackCollapsed[charIndex] = !state.ui.backpackCollapsed[charIndex];
        } else if (section === 'largeSack') {
          state.ui.largeSackCollapsed[charIndex] = !state.ui.largeSackCollapsed[charIndex];
        } else if (section === 'smallSack') {
          state.ui.smallSackCollapsed[charIndex] = !state.ui.smallSackCollapsed[charIndex];
        }
        
        saveState('ui', state.ui);
        renderChars();
      });
    });
    
    charEl.appendChild(inv);
  wrap.appendChild(charEl);
  });
}

export { renderChars };

