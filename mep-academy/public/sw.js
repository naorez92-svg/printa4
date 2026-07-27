/* Service Worker — אופליין לאתרי בנייה, חניונים תת-קרקעיים וממ"דים.
 * כל תוכן הקורס סטטי ונטען עם האפליקציה, ולכן ביקור אחד עם רשת מספיק
 * כדי שהאפליקציה כולה תעבוד בלי קליטה. אסטרטגיה:
 * - ניווטים: network-first (עדכניות הפריסה נשמרת) עם נפילה לעותק השמור.
 * - נכסי בילד (hashed) וגופנים: cache-first — קבצים חתומים לא משתנים.
 * - Supabase: לא מיורט בכלל — סנכרון ההתקדמות ממילא נכשל בשקט בלי רשת.
 */

const CACHE = "mep-academy-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheFirst(request) {
  return caches.match(request).then(
    (hit) =>
      hit ||
      fetch(request).then((res) => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
  );
}

function networkFirstNavigation(request) {
  return fetch(request)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        // כל הניווטים מגישים את אותו SPA shell — נשמר תחת "/"
        caches.open(CACHE).then((cache) => cache.put("/", copy));
      }
      return res;
    })
    .catch(() => caches.match("/"));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // סנכרון/התחברות Supabase — תמיד רשת, בלי מטמון
  if (url.hostname.endsWith(".supabase.co")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const isOwnAsset = url.origin === self.location.origin;
  const isFont =
    url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (isOwnAsset || isFont) {
    event.respondWith(cacheFirst(request));
  }
});
