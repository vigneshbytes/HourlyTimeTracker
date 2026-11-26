// Service worker: precaches the whole app so it runs fully offline.
const VERSION = '__VERSION__';
const CACHE = `htt-${VERSION}`;
const PRECACHE = '__PRECACHE__';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith('htt-') || k.startsWith('timetracker-')) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Navigations always get the cached app shell (works offline; hash routing handles views).
    event.respondWith(caches.match('./', { cacheName: CACHE, ignoreVary: true }).then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req, { cacheName: CACHE, ignoreVary: true }).then((hit) => hit || fetch(req)));
});
