import { openDB, requestPersistence, isPersisted, estimate, countAll, put, uid, STORES } from './storage.js';
import { setupEraseFlow } from './erase.js';
import { APP_VERSION } from './version.js';

const $ = (id) => document.getElementById(id);

function fmtBytes(b) {
  if (b == null) return '?';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i ? 1 : 0)} ${u[i]}`;
}

async function refreshStatus() {
  const p = await isPersisted();
  $('persist-status').textContent = p === null ? 'Not supported in this browser' : p ? 'Granted ✓' : 'Not granted (browser may evict data under pressure)';
  $('persist-btn').hidden = p !== false;
  const est = await estimate();
  $('usage-status').textContent = est ? `${fmtBytes(est.usage)} of ${fmtBytes(est.quota)}` : 'Unknown';
  $('record-count').textContent = String(await countAll());
}

async function init() {
  $('app-version').textContent = `v${APP_VERSION}`;
  try {
    await openDB();
    $('db-status').textContent = 'IndexedDB ready ✓';
  } catch (e) {
    $('db-status').textContent = `Unavailable: ${e.message}`;
    return;
  }
  await requestPersistence();
  await refreshStatus();

  $('persist-btn').addEventListener('click', async () => { await requestPersistence(); refreshStatus(); });
  $('sample-btn').addEventListener('click', async () => {
    await put(STORES.meta, { key: `test-${uid()}`, value: new Date().toISOString() });
    refreshStatus();
  });
  setupEraseFlow({ onErased: refreshStatus });
}

// Service worker for offline use and installability.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then(() => navigator.serviceWorker.ready)
    .then(() => { $('sw-status').textContent = 'Yes ✓'; })
    .catch((e) => { $('sw-status').textContent = `No (${e.message})`; });
} else {
  document.addEventListener('DOMContentLoaded', () => { $('sw-status').textContent = 'Not supported'; });
}

// Custom install button (Chromium browsers). iOS: Share > Add to Home Screen.
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('install-btn').hidden = false;
});
window.addEventListener('appinstalled', () => { $('install-btn').hidden = true; });
document.addEventListener('DOMContentLoaded', () => {
  $('install-btn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('install-btn').hidden = true;
  });
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
