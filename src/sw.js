// Service worker: precaches the whole app so it runs fully offline.
const VERSION = '__VERSION__';
const CACHE = `htt-${VERSION}`;
const PRECACHE = '__PRECACHE__';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' skips the browser's HTTP cache, so a stale copy of the
    // page (GitHub Pages caches for 10 min) can never be stored with new files.
    await cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })));
    // Sanity check: the cached page must point at the files we just cached.
    const html = await (await cache.match('./')).text();
    const assets = PRECACHE.filter((u) => u.startsWith('./assets/'));
    if (!assets.every((a) => html.includes(a.slice(2)))) {
      await caches.delete(CACHE);
      throw new Error('Cached page does not match this version; keeping the previous one.');
    }
    // Activate right away; the page offers a reload to pick up the new version.
    self.skipWaiting();
  })());
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
    event.respondWith(caches.match('./', { cacheName: CACHE, ignoreVary: true }).then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req, { cacheName: CACHE, ignoreVary: true }).then((hit) => hit || fetch(req)));
});
