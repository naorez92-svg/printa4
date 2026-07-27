/* Service Worker — אופליין לאתרי בנייה, חניונים תת-קרקעיים וממ"דים.
 * כל תוכן הקורס סטטי ונטען עם האפליקציה, ולכן ביקור אחד עם רשת מספיק
 * כדי שהאפליקציה כולה תעבוד בלי קליטה. אסטרטגיה:
 * - ניווטים: network-first עם נפילה ל-shell השמור. נשמר רק מסמך HTML אמיתי
 *   ולא-מופנה — אחרת ניווט ישיר לקובץ (icon.svg וכד') היה מרעיל את ה-shell
 *   וכל פתיחה אופליין הייתה מגישה אותו במקום האפליקציה.
 * - נכסי בילד (/assets/, שמות עם hash): cache-first — קובץ חתום לא משתנה;
 *   עם קיצוץ תקופתי כדי שגרסאות ישנות לא יצטברו בלי גבול.
 * - שאר קבצי המקור (אייקונים, מניפסט): network-first — עדכון מגיע מיד,
 *   והעותק השמור משמש רק באופליין.
 * - גופנים: cache-first; תגובות opaque נשמרות רק לשני דומייני הגופנים.
 * - Supabase: לא מיורט בכלל — סנכרון ההתקדמות ממילא נכשל בשקט בלי רשת.
 */

const CACHE = "mep-academy-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/icon.svg"];
const ASSET_LIMIT = 80; // ~2 פריסות של האפליקציה — מספיק לרוחב, חסום לגובה

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

async function trimAssets(cache) {
  const keys = await cache.keys();
  const assets = keys.filter((req) => new URL(req.url).pathname.startsWith("/assets/"));
  // keys() מוחזר לפי סדר הכנסה — הישנים ראשונים
  for (const req of assets.slice(0, Math.max(0, assets.length - ASSET_LIMIT))) {
    await cache.delete(req);
  }
}

function cacheFirst(request, { allowOpaque = false, trim = false } = {}) {
  return caches.match(request).then(
    (hit) =>
      hit ||
      fetch(request).then(async (res) => {
        if (res.ok || (allowOpaque && res.type === "opaque")) {
          const copy = res.clone();
          const cache = await caches.open(CACHE);
          await cache.put(request, copy);
          if (trim) trimAssets(cache);
        }
        return res;
      })
  );
}

function networkFirst(request) {
  return fetch(request)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return res;
    })
    .catch(() => caches.match(request));
}

function networkFirstNavigation(request) {
  return fetch(request)
    .then((res) => {
      // רק מסמך HTML לא-מופנה נשמר כ-shell (כל הניווטים מגישים את אותו SPA)
      if (res.ok && !res.redirected && res.headers.get("content-type")?.includes("text/html")) {
        const copy = res.clone();
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

  const isFont =
    url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (isFont) {
    event.respondWith(cacheFirst(request, { allowOpaque: true }));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/assets/")) {
      event.respondWith(cacheFirst(request, { trim: true }));
    } else {
      event.respondWith(networkFirst(request));
    }
  }
});
