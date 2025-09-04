/* ===== Safe Storage Helpers ===== */
// Provides wrappers around localStorage that guard against quota errors
// or disabled storage. Each function returns null/false when storage
// cannot be accessed.

export function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`Failed to read ${key} from localStorage:`, err);
    return null;
  }
}

export function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (err && err.name === 'QuotaExceededError') {
      console.warn(`localStorage quota exceeded for ${key}`);
    } else {
      console.warn(`Failed to write ${key} to localStorage:`, err);
    }
    return false;
  }
}
