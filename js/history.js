/* ===== Inventory History Utilities ===== */
import {
  database,
  ref,
  get
} from './firebase-config.js';
import { state, saveState } from './state.js';

// Fetch all saved history snapshots
async function fetchHistory() {
  const snapshot = await get(ref(database, 'inventory/history'));
  return snapshot.val() || {};
}

// Restore a snapshot by its key
async function restoreSnapshot(key) {
  const snapshot = await get(ref(database, `inventory/history/${key}`));
  const data = snapshot.val();
  if (!data) return null;

  state.chars = data.chars || [];
  saveState();
  return data;
}

export {
  fetchHistory,
  restoreSnapshot
};
