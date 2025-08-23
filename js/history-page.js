import { fetchHistory, restoreSnapshot } from './history.js';

function createEntry(key, data) {
  const entry = document.createElement('div');
  entry.className = 'history-entry';

  const time = document.createElement('time');
  const date = data.timestamp ? new Date(data.timestamp).toLocaleString() : 'unknown time';
  time.textContent = `${date} (${data.sessionId || 'unknown'})`;
  entry.appendChild(time);

  const btn = document.createElement('button');
  btn.textContent = 'Restore';
  btn.addEventListener('click', async () => {
    await restoreSnapshot(key);
    alert('Snapshot restored');
  });
  entry.appendChild(btn);

  return entry;
}

async function loadHistory() {
  const container = document.getElementById('historyList');
  container.textContent = 'Loading...';
  try {
    const history = await fetchHistory();
    container.innerHTML = '';
    const entries = Object.entries(history).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
    if (!entries.length) {
      container.textContent = 'No history available.';
      return;
    }
    entries.forEach(([key, data]) => container.appendChild(createEntry(key, data)));
  } catch (err) {
    container.textContent = 'Failed to load history.';
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', loadHistory);
