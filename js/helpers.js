/* ===== Helpers & Rules ===== */
const $ = s => document.querySelector(s);

function slotsFromSTR(str){
  const s = Math.floor(Number(str) || 0);
  if (s >= 18) return 19;
  if (s >= 16) return 18;
  if (s >= 13) return 17;
  if (s >= 9)  return 16;
  if (s >= 6)  return 15;
  if (s >= 4)  return 14;
  return 13; // STR 3 or lower
}

// Strict thresholds (< 6 / < 4 / < 2)
function speedFactorFromEmpty(empty){
  if (empty < 2) return 0.25; // 30'
  if (empty < 4) return 0.50; // 60'
  if (empty < 6) return 0.75; // 90'
  return 1.00;                // 120'
}

function fmtSpeed(feet){
  const squares = Math.round(feet/3);
  return `${feet}' (${squares}')`;
}

function slowdownLabel(empty,total){
  const used = total - empty;
  if (empty < 2) return `Severely Slowed — ${used}/${total} used`;
  if (empty < 4) return `Heavily Slowed — ${used}/${total} used`;
  if (empty < 6) return `Slowed — ${used}/${total} used`;
  return `Unburdened — ${used}/${total} used`;
}

// Helper functions for multi-slot items
function contiguousEmpty(slotsArr, start, needed){
  for (let i=0;i<needed;i++){
    const pos = start + i;
    if (pos >= slotsArr.length || slotsArr[pos]) return false;
  }
  return true;
}

function placeMulti(slotsArr, start, name, needed){
  slotsArr[start] = { name, slots: needed, head:true };
  for (let i=1;i<needed;i++) slotsArr[start+i] = { link: start };
}

// These functions are exported but will receive state from the importing module
function tryPlaceMulti(charIdx, start, name, needed, charSlots, section, source = null){
  const slotsArr = charSlots;
  if (!contiguousEmpty(slotsArr, start, needed)){
    alert(`Not enough contiguous empty slots for ${name} (${needed} slots) in ${section}.`);
    return false;
  }
  
  // Create the new item
  const newItem = { name, slots: needed, head: true };
  
  // If a source item is provided, copy its sub-slot properties
  if (source) {
    if (source.hasSubSlots) {
      newItem.hasSubSlots = true;
      newItem.maxSubSlots = source.maxSubSlots || 1;
      newItem.filledSubSlots = source.filledSubSlots !== undefined ? 
                              source.filledSubSlots : 
                              source.maxSubSlots || 1;
      newItem.subSlotName = source.subSlotName || 'unit';
    }
    
    // Copy coin slot properties if this is a coin purse
    if (source.hasCoinSlots) {
      newItem.hasCoinSlots = true;
      newItem.coinTypes = source.coinTypes || ["PP", "GP", "SP", "CP", "EP", "Gems"];
      newItem.coinAmounts = source.coinAmounts ? {...source.coinAmounts} : {};
    }
  }
  
  // Place the item
  slotsArr[start] = newItem;
  
  // Create links for multi-slot items
  for (let i = 1; i < needed; i++) {
    slotsArr[start + i] = { link: start };
  }
  
  return true;
}

function removeMulti(charIdx, headIndex, charSlots, section){
  const arr = charSlots;
  const head = arr[headIndex]; if (!head?.head) return;
  const len = Math.max(1, Number(head.slots||1));
  for (let i=0;i<len;i++) arr[headIndex+i] = null;
}

function moveMulti(fromChar, headIndex, toChar, toStart, len, fromCharSlots, toCharSlots, sourceSection, targetSection){
  const srcArr = fromCharSlots;
  const dstArr = toCharSlots;
  if (fromChar === toChar && toStart === headIndex && sourceSection === targetSection) return;

  // Get item details before removing it from source
  const sourceItem = srcArr[headIndex];
  if (!sourceItem) return;
  
  const name = sourceItem.name || "Item";
  const slots = Math.max(1, Number(len||1));
  
  // Check if source item has sub-slots
  const hasSubSlots = sourceItem.hasSubSlots || false;
  const maxSubSlots = sourceItem.maxSubSlots || 1;
  const filledSubSlots = sourceItem.filledSubSlots !== undefined ? sourceItem.filledSubSlots : maxSubSlots;
  const subSlotName = sourceItem.subSlotName || 'unit';
  
  // Check if destination already has an item with the same name
  const destItem = dstArr[toStart];
  if (destItem && destItem.head && destItem.name === name && hasSubSlots && destItem.hasSubSlots) {
    // We can merge these items if they have sub-slots of the same type
    // Calculate total filled sub-slots and max capacity
    const destFilledSubSlots = destItem.filledSubSlots !== undefined ? destItem.filledSubSlots : destItem.maxSubSlots;
    const destMaxSubSlots = destItem.maxSubSlots || maxSubSlots;
    
    if (destFilledSubSlots < destMaxSubSlots) {
      // There's space to merge some or all sub-slots
      const emptySpaces = destMaxSubSlots - destFilledSubSlots;
      const transferAmount = Math.min(emptySpaces, filledSubSlots);
      
      // Update destination item with merged sub-slots
      destItem.filledSubSlots = destFilledSubSlots + transferAmount;
      
      // Update source item, removing merged sub-slots
      const remainingSubSlots = filledSubSlots - transferAmount;
      
      if (remainingSubSlots > 0) {
        // Still have some sub-slots left in source item, update it
        sourceItem.filledSubSlots = remainingSubSlots;
        return; // Done merging, exit early
      } else {
        // All sub-slots were moved, remove source item
        for (let i = 0; i < slots; i++) {
          srcArr[headIndex + i] = null;
        }
        return; // Done merging, exit early
      }
    }
  }

  // Snapshot origin before clearing it
  const snapshot = srcArr.slice();
  
  // Clear the original slots
  for (let i = 0; i < slots; i++) {
    srcArr[headIndex + i] = null;
  }

  // Try to place at destination
  if (contiguousEmpty(dstArr, toStart, slots)) {
    // Copy all properties from the source item
    const newItem = { 
      name, 
      slots, 
      head: true 
    };
    
    // Copy sub-slot properties if they exist
    if (hasSubSlots) {
      newItem.hasSubSlots = true;
      newItem.maxSubSlots = maxSubSlots;
      newItem.filledSubSlots = filledSubSlots;
      newItem.subSlotName = subSlotName;
    }
    
    // Copy coin slot properties if they exist
    const hasCoinSlots = sourceItem.hasCoinSlots || false;
    const coinTypes = sourceItem.coinTypes || ["PP", "GP", "SP", "CP", "EP", "Gems"];
    const coinAmounts = sourceItem.coinAmounts || {};
    
    if (hasCoinSlots) {
      newItem.hasCoinSlots = true;
      newItem.coinTypes = coinTypes;
      newItem.coinAmounts = {...coinAmounts}; // Create a copy to avoid reference issues
    }
    
    // Create a new item head at destination
    dstArr[toStart] = newItem;
    
    // Create links for multi-slot items
    for (let i = 1; i < slots; i++) {
      dstArr[toStart + i] = { link: toStart };
    }
  } else {
    // Not enough space, restore the source
    alert(`Not enough space to move ${name} (${slots} slots) to ${targetSection}.`);
    for (let i = 0; i < snapshot.length; i++) {
      srcArr[i] = snapshot[i];
    }
  }
}

export {
  $,
  slotsFromSTR,
  speedFactorFromEmpty,
  fmtSpeed,
  slowdownLabel,
  contiguousEmpty,
  placeMulti,
  tryPlaceMulti,
  removeMulti,
  moveMulti
};
