/* ===== Inventory History Utilities ===== */
import {
  database,
  ref,
  get,
  remove
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

  const oldLength = state.chars.length;
  state.chars = data.chars || [];
  state.chars.forEach((char, idx) => {
    saveState(`inventory/chars/${idx}`, char);
  });
  for (let i = state.chars.length; i < oldLength; i++) {
    remove(ref(database, `inventory/chars/${i}`));
  }
  return data;
}

export {
  fetchHistory,
  restoreSnapshot
};
