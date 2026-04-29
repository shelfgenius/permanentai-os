/* Personal AI OS — Service Worker v4 */
const CACHE = 'personal-ai-os-v4';
const OFFLINE_URL = '/';

const PRECACHE = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  /* Only handle GET requests — Cache API doesn't support HEAD/POST */
  if (request.method !== 'GET') return;
  /* Let API calls go through directly */
  if (request.url.includes('/api/') || request.url.includes(':8000')) return;
  /* Navigation: serve from cache or network */
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }
  /* Static assets: cache-first */
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
        const clone = resp.clone();
        caches.open(CACHE).then((c) => c.put(request, clone));
        return resp;
      }).catch(() => cached);
    })
  );
});
