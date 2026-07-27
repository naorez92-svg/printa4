const CACHE = 'beshvili-v2';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/', '/index.html'])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Hashed build assets + Google Fonts files are immutable (content-addressed
// filenames / versioned URLs) — safe to serve cache-first forever. Without this
// the "installed" PWA re-downloaded the whole bundle on every cold launch, and
// offline opens got a shell whose script tags 404.
const isImmutableAsset = (url) =>
  (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) ||
  url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', e => {
  // Network-first for navigation — fall back to cached shell offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  if (e.request.method !== 'GET') return;
  let url;
  try { url = new URL(e.request.url); } catch { return; }
  if (!isImmutableAsset(url)) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const resp = await fetch(e.request);
      if (resp.ok) c.put(e.request, resp.clone());
      return resp;
    })
  );
});
