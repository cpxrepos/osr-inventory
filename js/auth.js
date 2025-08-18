/* ===== Firebase Authentication ===== */
import {
  auth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from './firebase-config.js';
import { state, setUser, updateReadOnlyIndicator } from './state.js';
import { loadItemsFromFile } from './items.js';

function initAuth() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const provider = new GoogleAuthProvider();

  loginBtn?.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(err => console.error('Login failed', err));
  });

  logoutBtn?.addEventListener('click', () => {
    signOut(auth).catch(err => console.error('Logout failed', err));
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      setUser(user.uid);
      state.readOnlyMode = false;
      updateReadOnlyIndicator();
      loadItemsFromFile();
      if (loginBtn) loginBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
      setUser(null);
      state.readOnlyMode = true;
      updateReadOnlyIndicator();
      loadItemsFromFile();
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'inline-block';
    }
  });
}

export { initAuth };
