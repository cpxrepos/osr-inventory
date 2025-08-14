import { state, saveState, enableWrites } from '../state.js';
import { tryPlaceMulti, removeMulti, moveMulti } from '../helpers.js';

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
    
    // Add double click handler for empty slots to add new items
    slot.addEventListener("dblclick", () => {
      enableWrites(); // Enable writes on item edit
      // Create a new single-slot item with "New Item" name
      slotsArray[si] = { name: "New Item", slots: 1, head: true };
      saveState();
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
  } else if (isHead) {
    // Check if item has sub-slots
    const hasSubSlots = slotObj.hasSubSlots || false;
    const maxSubSlots = hasSubSlots ? Math.min(3, Math.max(1, slotObj.maxSubSlots || 1)) : 0;
    const subSlotName = hasSubSlots ? slotObj.subSlotName || 'unit' : '';
    // Initialize filledSubSlots if it doesn't exist
    if (hasSubSlots && slotObj.filledSubSlots === undefined) {
      slotObj.filledSubSlots = maxSubSlots; // Start with all sub-slots filled
      saveState();
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
      
      slotContent += `</div>
        <div class="sub-slot-actions">
          <button class="sub-slot-btn" data-action="use">Use 1 ${subSlotName}</button>
          ${filledSubSlots < maxSubSlots ? 
            `<button class="sub-slot-btn" data-action="refill">Refill 1 ${subSlotName}</button>` : ''}
        </div>
      `;
    }
// Add coin tracking if item is a Coin Purse
    else if (slotObj.hasCoinSlots || (slotObj.name && slotObj.name.toLowerCase().includes('coin'))) {
      // If this is a coin-related item but missing proper coin purse properties, add them
      if (!slotObj.hasCoinSlots) {
        console.log(`Converting ${slotObj.name} to proper coin purse`);
        slotObj.hasCoinSlots = true;
        slotObj.coinTypes = ["PP", "GP", "SP", "CP", "EP", "Gems"];
      }
      
      // Initialize coin amounts if they don't exist
      if (!slotObj.coinAmounts) {
        slotObj.coinAmounts = {};
        (slotObj.coinTypes || ["PP", "GP", "SP", "CP", "EP", "Gems"]).forEach(type => {
          slotObj.coinAmounts[type] = 0;
        });
        
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
        saveState();
      }
      
      // Initialize expanded state if it doesn't exist
      if (slotObj.expanded === undefined) {
        slotObj.expanded = false;
      }
      
      // Calculate total coins and value
      let totalCoins = 0;
      let totalValue = 0;
      
      (slotObj.coinTypes || ["PP","GP", "SP", "CP", "EP", "Gems"]).forEach(coinType => {
        const amount = slotObj.coinAmounts[coinType] || 0;
        totalCoins += amount;
        
        // Calculate value based on conversion rates
        switch(coinType) {
          case 'PP':
            totalValue += amount * 10; // PP is worth 10 GP
            break;
          case 'GP':
            totalValue += amount; // GP is base unit
            break;
          case 'SP':
            totalValue += amount / 10; // SP is base unit
            break;
          case 'CP':
            totalValue += amount / 100; // 10 CP = 1 SP
            break;
          case 'EP':
            totalValue += amount / 2; // 1 EP = 5 SP (half a GP)
            break;
          case 'Gems':
            // Gems have 0 value
            break;
        }
      });
      
      // Format total value in terms of highest denomination
      let formattedValue = '';
      if (totalValue >= 100) {
        // Display in PP when value is 100+ GP (10+ PP)
        const pp = Math.floor(totalValue / 100);
        const remainder = totalValue % 100;
        const gp = Math.floor(remainder / 10);
        const sp = Math.floor(remainder % 10);
        
        formattedValue = `${pp}PP`;
        if (gp > 0 || sp > 0) formattedValue += ` ${gp}GP`;
        if (sp > 0) formattedValue += ` ${sp}SP`;
      } else if (totalValue >= 10) {
        const gp = Math.floor(totalValue / 10);
        const sp = Math.floor(totalValue % 10);
        formattedValue = `${gp}GP${sp > 0 ? ` ${sp}SP` : ''}`;
      } else if (totalValue > 0) {
        formattedValue = `${Math.floor(totalValue)}SP`;
      } else {
        formattedValue = '0';
      }
      
      // Add collapsed summary or expanded coin inputs - use CSS classes instead of inline styles
      slotContent += `
        <div class="coin-summary ${slotObj.expanded ? 'hidden' : ''}">
          <span>${totalCoins}/100 coins (${formattedValue})</span>
        </div>
        <div class="coin-slots-container ${slotObj.expanded ? '' : 'hidden'}">
      `;
      
      // Create inputs for each coin type
      (slotObj.coinTypes || ["PP","GP", "SP", "CP", "EP", "Gems"]).forEach(coinType => {
        const amount = slotObj.coinAmounts[coinType] || 0;
        const coinColor = getCoinColor(coinType);
        slotContent += `
          <div class="coin-type-row">
            <span class="coin-icon" style="background-color: ${coinColor};">${coinType}</span>
            <input type="number" class="coin-amount" 
              data-coin-type="${coinType}" 
              value="${amount}" 
              min="0" 
              max="${100 - (totalCoins - amount)}" 
              data-char="${ci}" 
              data-slot="${si}" 
              data-section="${section}" />
            
          </div>
        `;
      });
      
      slotContent += `</div>`;
    }
    
    slotContent += `</div>
      <span class="slot-actions">
        <button class="btn" data-action="edit">Edit</button>
        <button class="btn danger" data-action="remove">Remove</button>
      </span>
    `;
    
    slot.innerHTML = slotContent;
  } else if (isLink) {
    const headIdx = slotObj.link;
    const head = slotsArray[headIdx];
    const label = head?.name ? head.name : "Occupied";
    slot.innerHTML = `<span class="item-tag">${label} (occupied)</span>`;
  }

  // Drag & drop
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
      const src = state.items[payload.idx]; 
      if (!src) return;
      enableWrites(); // Enable writes on item drop
      const targetArray = state.chars[tci][targetSection];
      tryPlaceMulti(tci, tsi, src.name, Math.max(1, Number(src.slots || 1)), targetArray, targetSection, src);
      saveState(); 
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
      saveState(); 
      renderChars(); 
      renderCharList();
    }
  });

  // Make multi-slot heads draggable
  if (isHead) {
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

  // Edit / Remove
  slot.addEventListener("dblclick", () => {
    if (!isHead) return;
    enableWrites(); // Enable writes on item edit
    const cur = slotsArray[si];
    const name = prompt("Item name:", cur.name);
    if (name === null) return;
    slotsArray[si] = { name, slots: cur.slots, head: true };
    for (let k = 1; k < cur.slots; k++) slotsArray[si + k] = { link: si };
    
    saveState(); 
    renderChars(); 
    renderCharList();
  });

  // Right-click functionality for item removal has been disabled
  slot.addEventListener("contextmenu", (e) => {
    e.preventDefault(); // Still prevent the default context menu
    // Item removal functionality has been removed
  });

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
      saveState();
    }
    // Toggle expanded state when clicking on the slot
    slot.addEventListener('click', (e) => {
      // Enhanced debugging
      console.log('Coin purse clicked', e.target.tagName, e.target.className);
      console.log('Current expanded state:', slotObj.expanded);
      
      // Don't toggle if clicking on inputs or buttons
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
        console.log('Ignoring click on input/button');
        return;
      }
      
      // Ensure we're not clicking on a button within the slot
      if (e.target.closest('.btn') || e.target.closest('.slot-actions')) {
        console.log('Ignoring click on button or slot action');
        return;
      }
      
      // Check if we're clicking on any interactive elements that should be excluded
      const isOnInteractiveElement = 
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'BUTTON' || 
        e.target.closest('.btn') !== null || 
        e.target.closest('.slot-actions') !== null;
      
      // If not on an interactive element, allow the click to toggle expansion
      if (!isOnInteractiveElement) {
        console.log('Toggling coin purse expanded state');
        enableWrites();
        // Toggle expanded state but don't re-render
        slotObj.expanded = !slotObj.expanded;
        console.log('New expanded state:', slotObj.expanded);
        
        // Create the expanded coin management view directly
        // This bypasses issues with the CSS hidden class and render cycles
        if (slotObj.expanded) {
          // Create the coin management interface directly
          slot.innerHTML = '';
          
          // Create container div
          const container = document.createElement('div');
          container.style.padding = '8px';
          
          // Create header with item name
          const header = document.createElement('div');
          header.innerHTML = `<span class="item-tag">${slotObj.name}</span>`;
          container.appendChild(header);
          
          // Create coin input fields
          const coinContainer = document.createElement('div');
          coinContainer.style.backgroundColor = '#0f1421';
          coinContainer.style.padding = '10px';
          coinContainer.style.borderRadius = '6px';
          coinContainer.style.marginTop = '8px';
          coinContainer.style.border = '1px solid #2a3042';
          
          // Add each coin type
          (slotObj.coinTypes || ["PP","GP", "SP", "CP", "EP", "Gems"]).forEach(coinType => {
            const amount = slotObj.coinAmounts[coinType] || 0;
            const coinColor = getCoinColor(coinType);
            
            // Create row
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.marginBottom = '6px';
            row.style.gap = '8px';
            
            // Create coin icon
            const coinIcon = document.createElement('span');
            coinIcon.className = 'coin-icon';
            coinIcon.style.backgroundColor = coinColor;
            coinIcon.textContent = coinType;
            
            // Create input
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'coin-amount';
            input.value = amount;
            input.min = 0;
            input.dataset.coinType = coinType;
            
            // Prevent arrow keys from changing the value
            input.addEventListener('keydown', (e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
              }
            });
            
            // Add event listener for input
            input.addEventListener('change', (e) => {
              enableWrites();
              slotObj.coinAmounts[coinType] = parseInt(e.target.value) || 0;
              saveState();
            });
            
            // Add elements to row
            row.appendChild(coinIcon);
            row.appendChild(input);
            row.appendChild(document.createTextNode('/100'));
            
            // Add row to container
            coinContainer.appendChild(row);
          });
          
          // Add a button to close the expanded view
          const closeBtn = document.createElement('button');
          closeBtn.className = 'btn';
          closeBtn.style.marginTop = '8px';
          closeBtn.style.width = '100%';
          closeBtn.textContent = 'Close';
          closeBtn.addEventListener('click', () => {
            slotObj.expanded = false;
            saveState();
            renderChars(); // Re-render to show closed state
          });
          
          // Assemble the UI
          container.appendChild(coinContainer);
          container.appendChild(closeBtn);
          
          // Add standard slot actions
          const actions = document.createElement('span');
          actions.className = 'slot-actions';
          actions.innerHTML = `
            <button class="btn" data-action="edit">Edit</button>
            <button class="btn danger" data-action="remove">Remove</button>
          `;
          
          // Add everything to the slot
          slot.appendChild(container);
          slot.appendChild(actions);
          slot.style.border = '2px solid #69a9ff';
          
          // Save state but don't re-render
          saveState();
        } else {
          // Let the regular render cycle handle collapsing
          saveState();
          renderChars();
        }
      } else {
        console.log('Click not on valid coin purse element');
      }
    });
    
    // Add event listeners to prevent arrow keys on coin inputs
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
        
        // Limit value to available space in coin purse (100 - other coins)
        const maxAllowed = 100 - totalOtherCoins;
        const value = Math.min(maxAllowed, Math.max(0, parseInt(e.target.value) || 0));
        e.target.value = value; // Update display to show clamped value
        
        // Update the coin amount in the state
        slotObj.coinAmounts = slotObj.coinAmounts || {};
        slotObj.coinAmounts[coinType] = value;
        saveState();
        renderChars(); // Re-render to update coin limits
      });
    });
    
    // Close expanded coin purse when clicking outside
    if (slotObj.expanded) {
      document.addEventListener('click', function closeExpandedCoinPurse(e) {
        // If click is outside the current slot
        if (!slot.contains(e.target)) {
          slotObj.expanded = false;
          saveState();
          renderChars();
          document.removeEventListener('click', closeExpandedCoinPurse);
        }
      });
    }
  }
  
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
      saveState(); 
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
        coinAmounts
      };
      
      for (let k = 1; k < cur.slots; k++) slotsArray[si + k] = { link: si };
      
      saveState(); 
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
        
        saveState();
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
        saveState();
        renderChars();
        renderCharList();
      }
    }
  });

  return slot;
}

export { createSlot };
