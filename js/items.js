/* ===== Items Management ===== */
import { state, saveState, enableWrites } from './state.js';
import { $, debounce } from './helpers.js';
import { 
  database, 
  ref, 
  onValue,
  get,
  set,
  push,
  child
} from './firebase-config.js';

// Load items from Firebase database, with fallback to local file for initial setup
async function loadItemsFromFile() {
  try {
    // First try to get items from Firebase
    try {
      const itemsRef = ref(database, 'items');
      const snapshot = await get(itemsRef).catch(err => {
        console.warn("Firebase read failed:", err);
        throw err; // Re-throw to go to the fallback
      });
      
      if (snapshot.exists() && snapshot.val()) {
        // We have items in Firebase, use those
        state.items = snapshot.val() || {};
        console.log("Loaded items from Firebase:", Object.keys(state.items).length);
      } else {
        // No items in Firebase yet, load from local file and push to Firebase
        console.log("No items in Firebase, initializing from local file");
        await initializeItemsFromLocalFile();
      }
    } catch(fbErr) {
      // Firebase access failed, fall back to local file
      console.warn("Firebase access failed, falling back to local file:", fbErr);
      await initializeItemsFromLocalFile();
    }
  } catch(err) {
    // All loading attempts failed
    console.error("All item loading attempts failed:", err);
    state.items = {}; // empty if not available
    saveState();
  }
  
  renderItems();
}

// Initialize items from local JSON file (only used for first-time setup)
async function initializeItemsFromLocalFile() {
  try {
    // First load from local file
    const res = await fetch('items.json', {cache:'no-store'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("items.json must be an array");

    // Normalize
    state.items = {};
    for (const it of data) {
      const item = {
        name: String(it.name || '').trim(),
        slots: Math.max(1, Number(it.slots || 1)),
        notes: typeof it.notes === 'string' ? it.notes : '',
        hasSubSlots: it.hasSubSlots || false,
        maxSubSlots: it.hasSubSlots ? Math.min(3, Math.max(1, Number(it.maxSubSlots || 1))) : 0,
        subSlotName: it.hasSubSlots ? String(it.subSlotName || 'unit') : '',
        hasCoinSlots: it.hasCoinSlots || false,
        coinTypes: it.hasCoinSlots ? (Array.isArray(it.coinTypes) ? it.coinTypes : ["PP", "GP", "SP", "CP", "EP", "Gems"]) : []
      };
      if (!item.name) continue;
      try {
        const newRef = push(ref(database, 'items'));
        state.items[newRef.key] = item;
        await set(newRef, item);
      } catch (fbErr) {
        console.warn("Could not save item to Firebase:", fbErr);
      }
    }

    saveState();
  } catch(err) {
    console.warn("Failed to load items from local file:", err);
    state.items = {};
    saveState();
  }
}

// Add a new item to the database
function addItem(name, slots, notes = "", hasSubSlots = false, maxSubSlots = 1, subSlotName = "") {
  enableWrites(); // Ensure we can write to Firebase
  
  // Validate input
  name = String(name || '').trim();
  slots = Math.max(1, Number(slots || 1));
  notes = String(notes || '').trim();
  hasSubSlots = Boolean(hasSubSlots);
  maxSubSlots = hasSubSlots ? Math.min(3, Math.max(1, Number(maxSubSlots || 1))) : 0;
  subSlotName = hasSubSlots ? String(subSlotName || 'unit').trim() : '';
  
  if (!name) return false;
  
  // Create the new item
  const newItem = { name, slots, notes, hasSubSlots, maxSubSlots, subSlotName };

  // Generate unique ID and add to local state
  const newRef = push(ref(database, 'items'));
  const id = newRef.key;
  state.items[id] = newItem;

  // Persist only this item
  saveState(`items/${id}`, newItem);

  // Update UI
  renderItems();

  return true;
}

// Edit an existing item
function editItem(id, name, slots, notes = "", hasSubSlots = false, maxSubSlots = 1, subSlotName = "") {
  enableWrites(); // Ensure we can write to Firebase
  
  // Validate input
  name = String(name || '').trim();
  slots = Math.max(1, Number(slots || 1));
  notes = String(notes || '').trim();
  hasSubSlots = Boolean(hasSubSlots);
  maxSubSlots = hasSubSlots ? Math.min(3, Math.max(1, Number(maxSubSlots || 1))) : 0;
  subSlotName = hasSubSlots ? String(subSlotName || 'unit').trim() : '';
  
  if (!name || !state.items[id]) return false;

  // Update the item
  state.items[id] = { name, slots, notes, hasSubSlots, maxSubSlots, subSlotName };

  // Persist only this item
  saveState(`items/${id}`, state.items[id]);

  // Update UI
  renderItems();

  return true;
}

// Delete an item from the database
function deleteItem(id) {
  enableWrites(); // Ensure we can write to Firebase
  
  if (!state.items[id]) return false;

  // Remove from local state
  delete state.items[id];

  // Persist removal
  saveState(`items/${id}`, null);

  // Update UI
  renderItems();

  return true;
}

// Render items list with optional search filter
function renderItems() {
  const q = ($("#q")?.value || "").toLowerCase().trim();
  const list = $("#itemList"); 
  if (!list) return;
  
  list.innerHTML = "";
  
  // Add "Create Item" button at the top
  const createBtnContainer = document.createElement("div");
  createBtnContainer.className = "create-item-container";
  
  const createBtn = document.createElement("button");
  createBtn.textContent = "Create Item";
  createBtn.className = "btn create-item-btn";
  createBtn.addEventListener("click", showCreateItemForm);
  
  createBtnContainer.appendChild(createBtn);
  list.appendChild(createBtnContainer);
  
  // Create form container (hidden initially)
  const formContainer = document.createElement("div");
  formContainer.id = "createItemForm";
  formContainer.className = "create-item-form hidden";
  formContainer.innerHTML = `
    <div class="form-grid">
      <div>
        <label for="itemName">Item Name</label>
        <input id="itemName" placeholder="New Item" />
      </div>
      <div>
        <label for="itemSlots">Slots</label>
        <input id="itemSlots" type="number" value="1" min="1" max="10" step="1" />
      </div>
      <div>
        <label for="itemNotes">Notes (optional)</label>
        <input id="itemNotes" placeholder="Item notes" />
      </div>
      <div>
        <label for="itemHasSubSlots">Has Sub-Slots</label>
        <input id="itemHasSubSlots" type="checkbox" />
      </div>
      <div class="sub-slot-options hidden">
        <label for="itemMaxSubSlots">Sub-Slots Per Item (1-3)</label>
        <input id="itemMaxSubSlots" type="number" value="3" min="1" max="3" step="1" />
      </div>
      <div class="sub-slot-options hidden">
        <label for="itemSubSlotName">Sub-Slot Name (e.g., "ration", "torch")</label>
        <input id="itemSubSlotName" placeholder="unit" />
      </div>
    </div>
    <div class="form-buttons">
      <button id="saveItemBtn" class="btn">Save Item</button>
      <button id="cancelItemBtn" class="btn">Cancel</button>
    </div>
  `;
  list.appendChild(formContainer);
  
  // Add event listeners to the form buttons
  $("#saveItemBtn")?.addEventListener("click", () => {
    const name = $("#itemName")?.value || "";
    const slots = $("#itemSlots")?.value || 1;
    const notes = $("#itemNotes")?.value || "";
    const hasSubSlots = $("#itemHasSubSlots")?.checked || false;
    const maxSubSlots = $("#itemMaxSubSlots")?.value || 3;
    const subSlotName = $("#itemSubSlotName")?.value || "unit";
    
    if (addItem(name, slots, notes, hasSubSlots, maxSubSlots, subSlotName)) {
      // Success, hide the form
      toggleCreateItemForm();
    } else {
      // Error, show message
      alert("Please enter a valid item name");
    }
  });

  // Debounced saving for notes field in create item form
  const createNotesInput = $("#itemNotes");
  if (createNotesInput) {
    if (!state.ui) state.ui = {};
    const debouncedCreateNotes = debounce(() => {
      enableWrites();
      saveState('ui/tempItemNotes', state.ui.tempItemNotes);
    }, 400);
    createNotesInput.addEventListener("input", () => {
      state.ui.tempItemNotes = createNotesInput.value;
      debouncedCreateNotes();
    });
  }
  
  // Toggle sub-slot options visibility based on checkbox state
  $("#itemHasSubSlots")?.addEventListener("change", () => {
    const hasSubSlots = $("#itemHasSubSlots").checked;
    document.querySelectorAll(".sub-slot-options").forEach(el => {
      el.classList.toggle("hidden", !hasSubSlots);
    });
  });
  
  $("#cancelItemBtn")?.addEventListener("click", toggleCreateItemForm);
  
  // Edit form container (hidden initially)
  const editFormContainer = document.createElement("div");
  editFormContainer.id = "editItemForm";
  editFormContainer.className = "create-item-form hidden"; // reuse create-item-form class
  editFormContainer.innerHTML = `
    <div class="form-grid">
      <input type="hidden" id="editItemId" />
      <div>
        <label for="editItemName">Item Name</label>
        <input id="editItemName" placeholder="Item Name" />
      </div>
      <div>
        <label for="editItemSlots">Slots</label>
        <input id="editItemSlots" type="number" value="1" min="1" max="10" step="1" />
      </div>
      <div>
        <label for="editItemNotes">Notes (optional)</label>
        <input id="editItemNotes" placeholder="Item notes" />
      </div>
      <div>
        <label for="editItemHasSubSlots">Has Sub-Slots</label>
        <input id="editItemHasSubSlots" type="checkbox" />
      </div>
      <div class="edit-sub-slot-options hidden">
        <label for="editItemMaxSubSlots">Sub-Slots Per Item (1-3)</label>
        <input id="editItemMaxSubSlots" type="number" value="3" min="1" max="3" step="1" />
      </div>
      <div class="edit-sub-slot-options hidden">
        <label for="editItemSubSlotName">Sub-Slot Name (e.g., "ration", "torch")</label>
        <input id="editItemSubSlotName" placeholder="unit" />
      </div>
    </div>
    <div class="form-buttons">
      <button id="updateItemBtn" class="btn">Update Item</button>
      <button id="cancelEditBtn" class="btn">Cancel</button>
    </div>
  `;
  list.appendChild(editFormContainer);
  
  // Add event listeners to the edit form buttons
  $("#updateItemBtn")?.addEventListener("click", () => {
    const id = $("#editItemId")?.value || "";
    const name = $("#editItemName")?.value || "";
    const slots = $("#editItemSlots")?.value || 1;
    const notes = $("#editItemNotes")?.value || "";
    const hasSubSlots = $("#editItemHasSubSlots")?.checked || false;
    const maxSubSlots = $("#editItemMaxSubSlots")?.value || 3;
    const subSlotName = $("#editItemSubSlotName")?.value || "unit";
    
    if (editItem(id, name, slots, notes, hasSubSlots, maxSubSlots, subSlotName)) {
      // Success, hide the form
      toggleEditItemForm();
    } else {
      // Error, show message
      alert("Please enter a valid item name");
    }
  });

  // Debounced saving for notes field in edit item form
  const editNotesInput = $("#editItemNotes");
  if (editNotesInput) {
    const debouncedEditNotes = debounce((id) => {
      enableWrites();
      saveState(`items/${id}/notes`, state.items[id].notes);
    }, 400);
    editNotesInput.addEventListener("input", () => {
      const id = $("#editItemId")?.value || "";
      if (!id || !state.items[id]) return;
      state.items[id].notes = editNotesInput.value;
      debouncedEditNotes(id);
    });
  }
  
  // Toggle sub-slot options visibility based on checkbox state
  $("#editItemHasSubSlots")?.addEventListener("change", () => {
    const hasSubSlots = $("#editItemHasSubSlots").checked;
    document.querySelectorAll(".edit-sub-slot-options").forEach(el => {
      el.classList.toggle("hidden", !hasSubSlots);
    });
  });
  
  $("#cancelEditBtn")?.addEventListener("click", toggleEditItemForm);

  const entries = Object.entries(state.items).filter(([id, i]) => !q || i.name.toLowerCase().includes(q));
  if (entries.length === 0) {
    const div = document.createElement("div");
    div.className = "muted";
    div.textContent = "No items found. Use the 'Create Item' button to add new items.";
    list.appendChild(div);
    return;
  }

  entries.forEach(([id, it]) => {
    const div = document.createElement("div");
    div.className = "item";
    div.draggable = true;
    
    // Create container for item content
    const contentDiv = document.createElement("div");
    contentDiv.className = "item-content";
    
    let itemDisplay = `<span>${it.name}</span><span class="muted">${it.slots} slot${it.slots>1?'s':''}</span>`;
    
    // Add sub-slot info if applicable
    if (it.hasSubSlots) {
      itemDisplay += `<span class="sub-slots-info">(${it.maxSubSlots} ${it.subSlotName}${it.maxSubSlots > 1 ? 's' : ''} per slot)</span>`;
    }
    
    contentDiv.innerHTML = itemDisplay;
    div.appendChild(contentDiv);
    
    // Create action buttons container
    const actionDiv = document.createElement("div");
    actionDiv.className = "item-actions";
    
    // Add edit button
    const editBtn = document.createElement("button");
    editBtn.className = "btn icon-btn";
    editBtn.innerHTML = "✏️";
    editBtn.title = "Edit Item";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent drag
      showEditItemForm(id);
    });
    actionDiv.appendChild(editBtn);
    
    // Add delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn icon-btn delete-btn";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.title = "Delete Item";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent drag
      if (confirm(`Are you sure you want to delete "${it.name}"?`)) {
        deleteItem(id);
      }
    });
    actionDiv.appendChild(deleteBtn);
    
    div.appendChild(actionDiv);
    
    div.addEventListener("dragstart", e => {
      // Use object reference lookup to get original index reliably
      e.dataTransfer.setData("text/plain", JSON.stringify({ type:"lib", id }));
    });
    
    list.appendChild(div);
  });
}

// Initialize item-related event listeners
function initItemEvents() {
  $("#q")?.addEventListener("input", renderItems);
  
  // Enable writes when user interacts with import/export buttons
  $("#exportBtn")?.addEventListener("click", enableWrites);
  $("#importBtn")?.addEventListener("click", enableWrites);
}

// Show/hide the create item form
function showCreateItemForm() {
  toggleCreateItemForm();
}

function toggleCreateItemForm() {
  const form = $("#createItemForm");
  if (form) {
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) {
      // Clear the form when showing it
      $("#itemName").value = "";
      $("#itemSlots").value = "1";
      $("#itemNotes").value = "";
      $("#itemHasSubSlots").checked = false;
      $("#itemMaxSubSlots").value = "3";
      $("#itemSubSlotName").value = "unit";
      document.querySelectorAll(".sub-slot-options").forEach(el => {
        el.classList.add("hidden");
      });
      if (!state.ui) state.ui = {};
      state.ui.tempItemNotes = "";
      $("#itemName").focus();
    } else {
      // Clear any stored draft when hiding
      if (state.ui) state.ui.tempItemNotes = "";
    }

    // Hide edit form if open
    const editForm = $("#editItemForm");
    if (editForm && !editForm.classList.contains("hidden")) {
      editForm.classList.add("hidden");
    }
  }
}

// Show/hide the edit item form
function showEditItemForm(id) {
  // Get the item
  const item = state.items[id];
  if (!item) return;

  // Fill the form with item data
  $("#editItemId").value = id;
  $("#editItemName").value = item.name;
  $("#editItemSlots").value = item.slots;
  $("#editItemNotes").value = item.notes || "";
  $("#editItemHasSubSlots").checked = item.hasSubSlots || false;
  $("#editItemMaxSubSlots").value = item.maxSubSlots || 3;
  $("#editItemSubSlotName").value = item.subSlotName || "unit";
  
  // Show/hide sub-slot options
  document.querySelectorAll(".edit-sub-slot-options").forEach(el => {
    el.classList.toggle("hidden", !item.hasSubSlots);
  });
  
  // Show the form
  toggleEditItemForm();
  
  // Focus on name field
  $("#editItemName").focus();
}

function toggleEditItemForm() {
  const form = $("#editItemForm");
  if (form) {
    form.classList.toggle("hidden");
    
    // Hide create form if open
    const createForm = $("#createItemForm");
    if (createForm && !createForm.classList.contains("hidden")) {
      createForm.classList.add("hidden");
    }
  }
}

export {
  loadItemsFromFile,
  renderItems,
  initItemEvents,
  addItem,
  editItem,
  deleteItem
};
