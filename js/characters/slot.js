import { state, saveState, enableWrites } from '../state.js';
import { tryPlaceMulti, removeMulti, moveMulti } from '../helpers.js';

// Track locally expanded coin purses (client-side only)
const expandedCoinPurses = new Set();
function getCoinColor(coinType) {
  switch(coinType) {
    case 'PP': return '#E5E4E2'; // Platinum (metallic silver-white)
    case 'GP': return '#FFD700'; // Gold
    case 'SP': return '#C0C0C0'; // Silver
    case 'CP': return '#B87333'; // Copper
    case 'EP': return '#AFE9DD'; // Electrum (blueish-silver)
    case 'Gems': return '#E0115F'; // Gems (ruby red)
    default: return '#888888';
  }
}

function createSlot(slotObj, ci, si, section, slotsArray, backpackSlots, renderChars, renderCharList) {
  const slot = document.createElement("div");
  const isEmpty = !slotObj;
  const isHead  = !!slotObj?.head;
  const isLink  = slotObj && (slotObj.link !== undefined);
  const isActive = state.selectedCharIndices.includes(ci);
  const isBeltPouch = section === "beltPouch";

  slot.className = "slot" + (isEmpty ? " empty" : "");
  slot.dataset.char = ci;
  slot.dataset.slot = si;
  slot.dataset.section = section; // Identify which inventory section this is

  // Bottom-up coloring for backpack and large sack (encumbrance rules apply to both)
  if (section === "backpack" || section === "largeSack") {
    const posFromBottom = backpackSlots - si;
    if (posFromBottom <= 2) {
      slot.classList.add("danger"); // red (1–2)
    } else if (posFromBottom <= 4) {
      slot.classList.add("orange"); // orange (3–4)
    } else if (posFromBottom <= 6) {
      slot.classList.add("warn");   // yellow (5–6)
    }
  }
  // Coloring for equipped slots based on speed penalties
  else if (section === "equipped") {
    // 8-9 slots filled = speed 30
    if (si >= 7) {
      slot.classList.add("danger"); 
    } 
    // 6-7 slots filled = speed 60
    else if (si >= 5) {
      slot.classList.add("orange");
    } 
    // 4-5 slots filled = speed 90
    else if (si >= 3) {
      slot.classList.add("warn");
    }
    // 1-3 slots filled = speed 120 (no penalty)
  }

  // Content
  if (isEmpty) {
    slot.innerHTML = `<span class="item-tag">Empty</span>`;

    if (isActive && !isBeltPouch) {
      // Add double click handler for empty slots to add new items
      slot.addEventListener("dblclick", () => {
        enableWrites(); // Enable writes on item edit
        // Create a new single-slot item with "New Item" name
        slotsArray[si] = { name: "New Item", slots: 1, head: true };
        saveState(`inventory/chars/${ci}`, state.chars[ci]);
        renderChars();
        renderCharList();

        // Immediately trigger the edit functionality for this new item
        // We need to find the item after re-rendering
        setTimeout(() => {
          const newSlot = document.querySelector(`.slot[data-char="${ci}"][data-slot="${si}"][data-section="${section}"]`);
          if (newSlot) {
            const editButton = newSlot.querySelector('button[data-action="edit"]');
            if (editButton) {
              editButton.click();
            }
          }
        }, 50);
      });
    }
  } else if (isHead) {
    // Check if item has sub-slots
    const hasSubSlots = slotObj.hasSubSlots || false;
    const maxSubSlots = hasSubSlots ? Math.min(3, Math.max(1, slotObj.maxSubSlots || 1)) : 0;
    const subSlotName = hasSubSlots ? slotObj.subSlotName || 'unit' : '';
    // Initialize filledSubSlots if it doesn't exist
    if (hasSubSlots && slotObj.filledSubSlots === undefined) {
      slotObj.filledSubSlots = maxSubSlots; // Start with all sub-slots filled
      saveState(`inventory/chars/${ci}`, state.chars[ci]);
    }
    
    let slotContent = `
      <div>
        <span class="item-tag">${slotObj.name}${slotObj.slots>1 ? ` (${slotObj.slots} slots)` : ""}</span>
    `;
    
    // Add sub-slot indicators if item has sub-slots
    if (hasSubSlots) {
      const filledSubSlots = Math.min(maxSubSlots, Math.max(0, slotObj.filledSubSlots || 0));
      slotContent += `
        <div class="sub-slots-container">
      `;

      // Create visual indicators for sub-slots
      for (let i = 0; i < maxSubSlots; i++) {
        const isFilled = i < filledSubSlots;
        slotContent += `<span class="sub-slot ${isFilled ? 'filled' : 'empty'}" title="${isFilled ? 'Used' : 'Empty'} ${subSlotName}"></span>`;
      }

      if (isActive) {
        slotContent += `</div>
        <div class="sub-slot-actions">
          <button class="sub-slot-btn" data-action="use">Use 1 ${subSlotName}</button>
          ${filledSubSlots < maxSubSlots ?
            `<button class=\"sub-slot-btn\" data-action=\"refill\">Refill 1 ${subSlotName}</button>` : ''}
        </div>
      `;
      } else {
        slotContent += `</div>`;
      }
    }
// Add coin tracking if item is a Coin Purse
    else if (slotObj.hasCoinSlots || (slotObj.name && slotObj.name.toLowerCase().includes('coin'))) {
      // If this is a coin-related item but missing proper coin purse properties, add them
      let coinPropsUpdated = false;

      if (!slotObj.hasCoinSlots) {
        console.log(`Converting ${slotObj.name} to proper coin purse`);
        slotObj.hasCoinSlots = true;
        slotObj.coinTypes = ["PP", "GP", "SP", "CP", "EP", "Gems"];
        coinPropsUpdated = true;
      }

      if (typeof slotObj.coinLimit !== 'number' || Number.isNaN(slotObj.coinLimit)) {
        slotObj.coinLimit = 100;
        coinPropsUpdated = true;
      }

      // Initialize coin amounts if they don't exist
      if (!slotObj.coinAmounts) {
        slotObj.coinAmounts = {};
        (slotObj.coinTypes || ["PP", "GP", "SP", "CP", "EP", "Gems"]).forEach(type => {
          slotObj.coinAmounts[type] = 0;
        });
        coinPropsUpdated = true;

        // If the name contains a coin amount like "32gp", set the initial amount
        if (slotObj.name && slotObj.name.toLowerCase().includes('coin')) {
          const match = slotObj.name.match(/(\d+)([a-z]+)/i);
          if (match) {
            const amount = parseInt(match[1]);
            const type = match[2].toUpperCase();
            if (!isNaN(amount) && ["PP","GP", "SP", "CP", "EP"].includes(type)) {
              console.log(`Setting initial coin amount: ${amount}${type}`);
              slotObj.coinAmounts[type] = amount;
            }
          }
        }
      }
      if (coinPropsUpdated) {
        saveState(`inventory/chars/${ci}`, state.chars[ci]);
      }
      // Determine if this coin purse is currently expanded (client-side only)
      const purseKey = `${ci}-${section}-${si}`;
      const isExpanded = expandedCoinPurses.has(purseKey);

      // Calculate total coins and build a summary of coin amounts
      const coinLimit = slotObj.coinLimit || 100;
      let totalCoins = 0;
      const valueParts = [];
      (slotObj.coinTypes || ["PP","GP", "SP", "CP", "EP", "Gems"]).forEach(coinType => {
        const amount = slotObj.coinAmounts[coinType] || 0;
        totalCoins += amount;
        if (amount > 0) {
          valueParts.push(`${amount}${coinType}`);
        }
      });

      const formattedValue = valueParts.join(' ') || '0';
      
      // Add collapsed summary or expanded coin inputs - use CSS classes instead of inline styles
      slotContent += `
        <div class="coin-summary ${isExpanded ? 'hidden' : ''}">
          <span>${totalCoins}/${coinLimit} coins (${formattedValue})</span>
        </div>
        <div class="coin-slots-container ${isExpanded ? '' : 'hidden'}">
      `;

      // Create inputs for each coin type
      (slotObj.coinTypes || ["PP","GP", "SP", "CP", "EP", "Gems"]).forEach(coinType => {
        const amount = slotObj.coinAmounts[coinType] || 0;
        const coinColor = getCoinColor(coinType);
        const remaining = Math.max(0, coinLimit - (totalCoins - amount));
        slotContent += `
          <div class="coin-type-row">
            <span class="coin-icon" style="background-color: ${coinColor};">${coinType}</span>
            <input type="number" class="coin-amount"
              data-coin-type="${coinType}"
              value="${amount}"
              min="0"
              max="${remaining}"
              data-char="${ci}"
              data-slot="${si}"
              data-section="${section}"
              ${isActive ? '' : 'disabled'} />

          </div>
        `;
      });
      
      slotContent += `</div>`;
    }

    slotContent += `</div>`;
    if (isActive && !isBeltPouch) {
      slotContent += `
      <span class="slot-actions">
        <button class="btn" data-action="edit">Edit</button>
        <button class="btn danger" data-action="remove">Remove</button>
      </span>
    `;
    }
    
    slot.innerHTML = slotContent;
  } else if (isLink) {
    const headIdx = slotObj.link;
    const head = slotsArray[headIdx];
    const label = head?.name ? head.name : "Occupied";
    slot.innerHTML = `<span class="item-tag">${label} (occupied)</span>`;
  }

  // Drag & drop only for active character
  if (isActive) {
    slot.addEventListener("dragover", e => {
      e.preventDefault();
      slot.classList.add("dragover");
    });

    slot.addEventListener("dragleave", () => slot.classList.remove("dragover"));

    slot.addEventListener("drop", e => {
      e.preventDefault();
      slot.classList.remove("dragover");
      const payload = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
      const tci = ci, tsi = si;
      const targetSection = section; // equipped or backpack

      if (payload.type === "lib") {
        const src = state.items[payload.id];
        if (!src) return;
        enableWrites(); // Enable writes on item drop
        const targetArray = state.chars[tci][targetSection];
        tryPlaceMulti(tci, tsi, src.name, Math.max(1, Number(src.slots || 1)), targetArray, targetSection, src);
        saveState(`inventory/chars/${tci}`, state.chars[tci]);
        renderChars();
        renderCharList();
      }
      else if (payload.type === "slotHead") {
        const { fromChar, headIndex, length } = payload;
        const sourceSection = payload.section || "backpack"; // Default to backpack for compatibility with old data
        enableWrites(); // Enable writes on item move
        const sourceArray = state.chars[fromChar][sourceSection];
        const targetArray = state.chars[tci][targetSection];
        moveMulti(fromChar, headIndex, tci, tsi, length, sourceArray, targetArray, sourceSection, targetSection);
        saveState(`inventory/chars/${fromChar}`, state.chars[fromChar]);
        if (fromChar !== tci) {
          saveState(`inventory/chars/${tci}`, state.chars[tci]);
        }
        renderChars();
        renderCharList();
      }
    });
  }

  // Make multi-slot heads draggable
  if (isHead && isActive && !isBeltPouch) {
    slot.draggable = true;
    slot.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", JSON.stringify({
        type: "slotHead",
        fromChar: ci,
        headIndex: si,
        section: section,
        length: slotsArray[si].slots || 1
      }));
    });
  }

  // Edit / Remove and context actions only for active character
  if (isHead && isActive && !isBeltPouch) {
    slot.addEventListener("dblclick", () => {
      enableWrites(); // Enable writes on item edit
      const cur = slotsArray[si];
      const name = prompt("Item name:", cur.name);
      if (name === null) return;
      slotsArray[si] = { name, slots: cur.slots, head: true };
      for (let k = 1; k < cur.slots; k++) slotsArray[si + k] = { link: si };

      saveState(`inventory/chars/${ci}`, state.chars[ci]);
      renderChars();
      renderCharList();
    });

    // Right-click to duplicate an item into the next available slot
    slot.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (!confirm("Duplicate this item?")) return;

      enableWrites();
      const cur = slotsArray[si];
      const len = Math.max(1, Number(cur.slots || 1));

      // Helper to check for contiguous empty slots
      const hasSpace = (arr, start, needed) => {
        for (let i = 0; i < needed; i++) {
          if (start + i >= arr.length || arr[start + i]) return false;
        }
        return true;
      };

      let target = -1;
      const startSearch = si + len;

      // Search after the current item
      for (let idx = startSearch; idx <= slotsArray.length - len; idx++) {
        if (hasSpace(slotsArray, idx, len)) { target = idx; break; }
      }

      // Wrap around to the beginning if needed
      if (target === -1) {
        for (let idx = 0; idx <= si - len; idx++) {
          if (hasSpace(slotsArray, idx, len)) { target = idx; break; }
        }
      }

      if (target === -1) {
        alert("No empty slots available to duplicate this item.");
        return;
      }

      tryPlaceMulti(ci, target, cur.name, len, slotsArray, section, cur);
      saveState(`inventory/chars/${ci}`, state.chars[ci]);
      renderChars();
      renderCharList();
    });
  }

  // Add event listener for coin amount updates
  if (isHead && (slotObj.hasCoinSlots || (slotObj.name && slotObj.name.toLowerCase().includes('coin')))) {
    // Ensure it has proper coin purse properties
      if (!slotObj.hasCoinSlots) {
      slotObj.hasCoinSlots = true;
      slotObj.coinTypes = ["PP","GP", "SP", "CP", "EP", "Gems"];
      if (!slotObj.coinAmounts) {
        slotObj.coinAmounts = {};
        slotObj.coinTypes.forEach(type => {
          slotObj.coinAmounts[type] = 0;
        });
      }
      saveState(`inventory/chars/${ci}`, state.chars[ci]);
    }
    // Toggle expanded state when clicking on the slot
    slot.addEventListener('click', (e) => {
      const isInteractive =
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'BUTTON' ||
        e.target.closest('.btn') !== null ||
        e.target.closest('.slot-actions') !== null;

      if (isInteractive || !isActive) return;

      enableWrites();
      const purseKey = `${ci}-${section}-${si}`;
      if (expandedCoinPurses.has(purseKey)) {
        expandedCoinPurses.delete(purseKey);
      } else {
        expandedCoinPurses.add(purseKey);
      }
      renderChars();
    });

    // Close expanded coin purse when clicking outside
    if (expandedCoinPurses.has(`${ci}-${section}-${si}`)) {
      setTimeout(() => {
        function closeExpandedCoinPurse(e) {
          const slotElement = document.querySelector(`.slot[data-char="${ci}"][data-slot="${si}"][data-section="${section}"]`);
          if (!slotElement || !slotElement.contains(e.target)) {
            expandedCoinPurses.delete(`${ci}-${section}-${si}`);
            renderChars();
            document.removeEventListener('click', closeExpandedCoinPurse);
          }
        }
        document.addEventListener('click', closeExpandedCoinPurse);
      }, 0);
    }

    // Add event listeners to prevent arrow keys on coin inputs
    if (isActive) {
      slot.querySelectorAll('.coin-amount').forEach(input => {
        // Prevent up/down arrow keys from changing the value
        input.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
          }
        });

        // Handle input changes for coin amounts
        input.addEventListener('change', (e) => {
          enableWrites();
          const coinType = e.target.dataset.coinType;

          // Calculate total coins excluding the current type
          let totalOtherCoins = 0;
          Object.entries(slotObj.coinAmounts || {}).forEach(([type, amount]) => {
            if (type !== coinType) {
              totalOtherCoins += amount;
            }
          });

          // Limit value to available space in coin purse (coinLimit - other coins)
          const coinLimit = slotObj.coinLimit || 100;
          const maxAllowed = Math.max(0, coinLimit - totalOtherCoins);
          const value = Math.min(maxAllowed, Math.max(0, parseInt(e.target.value) || 0));
          e.target.value = value; // Update display to show clamped value

          // Update the coin amount in the state
          slotObj.coinAmounts = slotObj.coinAmounts || {};
          slotObj.coinAmounts[coinType] = value;
          saveState(`inventory/chars/${ci}`, state.chars[ci]);
          renderChars(); // Re-render to update coin limits
        });
      });
    }
    
  }
  
  if (isActive && !isBeltPouch) {
    slot.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.action === "remove") {
        enableWrites(); // Enable writes on remove button
        const headIdx = si;
      
      // Check if this is a sack in the equipped section
      if (section === "equipped" && slotObj && slotObj.head) {
        if (slotObj.name === "Sack (small)" && state.chars[ci].smallSack) {
          // Check if small sack contains any items
          const hasItems = state.chars[ci].smallSack.some(item => item !== null);
          if (hasItems) {
            alert("You must empty the Small Sack before removing it from equipped.");
            return;
          }
        } else if (slotObj.name === "Sack (large)" && state.chars[ci].largeSack) {
          // Check if large sack contains any items
          const hasItems = state.chars[ci].largeSack.some(item => item !== null);
          if (hasItems) {
            alert("You must empty the Large Sack before removing it from equipped.");
            return;
          }
        }
      }
      
      removeMulti(ci, headIdx, slotsArray, section);
      saveState(`inventory/chars/${ci}`, state.chars[ci]);
      renderChars();
        renderCharList();
      } else if (btn.dataset.action === "edit") {
        enableWrites(); // Enable writes on edit button
        const cur = slotsArray[si];
        const name = prompt("Item name:", cur.name);
        if (name === null) return;
      
      // Preserve sub-slot properties when editing
      const hasSubSlots = cur.hasSubSlots || false;
      const maxSubSlots = cur.maxSubSlots || 1;
      const filledSubSlots = cur.filledSubSlots !== undefined ? cur.filledSubSlots : maxSubSlots;
      const subSlotName = cur.subSlotName || 'unit';
      
      // Preserve coin slot properties when editing
      const hasCoinSlots = cur.hasCoinSlots || false;
      const coinTypes = cur.coinTypes || ["PP","GP", "SP", "CP", "EP", "Gems"];
      const coinAmounts = cur.coinAmounts || {};
      
      slotsArray[si] = {
        name,
        slots: cur.slots,
        head: true,
        hasSubSlots,
        maxSubSlots,
        filledSubSlots,
        subSlotName,
        hasCoinSlots,
        coinTypes,
        coinAmounts,
        coinLimit: cur.coinLimit ?? 100
      };
      
      for (let k = 1; k < cur.slots; k++) slotsArray[si + k] = { link: si };
      
      saveState(`inventory/chars/${ci}`, state.chars[ci]);
      renderChars();
        renderCharList();
      }
      else if (btn.dataset.action === "use") {
        // Handle consuming one sub-slot
        enableWrites();
        const cur = slotsArray[si];

        if (cur.hasSubSlots && cur.filledSubSlots > 0) {
          cur.filledSubSlots--;

          // If all sub-slots are used, ask if the user wants to remove the item
          if (cur.filledSubSlots === 0) {
            if (confirm(`All ${cur.subSlotName}s have been used. Remove the item?`)) {
              removeMulti(ci, si, slotsArray, section);
            }
          }

          saveState(`inventory/chars/${ci}`, state.chars[ci]);
          renderChars();
          renderCharList();
        }
      }
      else if (btn.dataset.action === "refill") {
        // Handle refilling one sub-slot
        enableWrites();
        const cur = slotsArray[si];

        if (cur.hasSubSlots && cur.filledSubSlots < cur.maxSubSlots) {
          cur.filledSubSlots++;
          saveState(`inventory/chars/${ci}`, state.chars[ci]);
          renderChars();
          renderCharList();
        }
      }
    });
  }

  return slot;
}

export { createSlot };
