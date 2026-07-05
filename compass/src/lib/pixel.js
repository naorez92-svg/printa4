// ─────────────────────────────────────────────────────────────────────────────
// Meta (Facebook) Pixel — browser-side conversion tracking.
//
// This is the measurement layer that lets paid Meta campaigns LEARN and
// optimize. Without it, every shekel spent on Facebook/Instagram ads is blind:
// Meta can't tell which clicks turned into signups, can't build lookalike
// audiences, and can't run retargeting. So this loads the pixel once on every
// page and forwards the handful of funnel events that actually matter as Meta
// "standard events".
//
// Privacy: we deliberately send NO personal data (no email / phone / name) to
// the pixel — only event names + non-PII counts. Advanced matching can be added
// later via the Conversions API (server-side, in the Edge Function).
//
// Setup: set VITE_FB_PIXEL_ID in the build env (see .env.local.example). When
// it's unset (local dev / preview), every function here is a safe no-op.
// ─────────────────────────────────────────────────────────────────────────────

const PIXEL_ID = import.meta.env.VITE_FB_PIXEL_ID;

let loaded = false;

// Inject the official Meta Pixel base snippet exactly once. Returns false (and
// does nothing) when no pixel id is configured, so callers never have to guard.
export function initPixel() {
  if (loaded || !PIXEL_ID || typeof window === "undefined") return false;
  loaded = true;

  /* eslint-disable */
  // Standard Meta base code (https://www.facebook.com/business/help/952192354843755).
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq("init", PIXEL_ID);
  window.fbq("track", "PageView");
  return true;
}

// Low-level passthrough to fbq. `kind` is "track" (standard events) or
// "trackCustom" (custom events). Never throws into the caller.
function emit(kind, name, params) {
  try {
    if (!PIXEL_ID || typeof window === "undefined" || typeof window.fbq !== "function") return;
    if (params && Object.keys(params).length) window.fbq(kind, name, params);
    else window.fbq(kind, name);
  } catch {
    /* a tracking failure must never break the app */
  }
}

// ── Internal event → Meta standard event map ────────────────────────────────
// Only the funnel-defining events are forwarded. Everything else stays in the
// internal `events` table for product analytics but is noise for ad
// optimization. Each entry: [Meta event name, isStandard]. Standard events
// (CompleteRegistration, Lead, InitiateCheckout…) are the ones Meta's optimizer
// and reporting understand natively; custom ones are for retargeting audiences.
const PIXEL_MAP = {
  // Activation / top-of-funnel
  signup_completed:   ["CompleteRegistration", true],

  // Core "aha" moment — a finished booklet. The single best optimization event:
  // a campaign told to optimize for this finds people who actually use the
  // product, not just tire-kickers who bounce after signup.
  booklet_completed:  ["BookletCreated", false],
  jewish_completed:   ["BookletCreated", false],

  // Monetization intent
  upgrade_modal_opened: ["InitiateCheckout", true],
  upgrade_intent_clicked: ["Lead", true], // name+phone submitted → WhatsApp handoff

  // Engagement signal usable for retargeting / lookalikes
  cta_click:          ["LandingCTA", false],
  pricing_cta_click:  ["ViewContent", true],
};

// Forward a single internal event to the pixel if (and only if) it maps to a
// Meta event. Called from the central track() emitter so there's exactly one
// place wiring the two systems together. `metadata` is the internal event's
// metadata; we copy only non-PII, pixel-meaningful fields.
export function forwardToPixel(event, metadata = {}) {
  const mapped = PIXEL_MAP[event];
  if (!mapped) return;
  const [name, isStandard] = mapped;

  // A compact, PII-free params object. content_category lets us segment
  // BookletCreated by track (regular vs Jewish) inside Meta reporting.
  const params = {};
  if (event === "jewish_completed") params.content_category = "jewish";
  else if (event === "booklet_completed") params.content_category = "regular";

  emit(isStandard ? "track" : "trackCustom", name, params);
}
