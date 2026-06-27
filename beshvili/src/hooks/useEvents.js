import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Full-funnel analytics. Unlike the old version, track() now fires for
// ANONYMOUS visitors too (pre-login), tying events to a persistent anonymous_id
// so the top of the funnel (landing → signup → activation) is measurable.
//
// Every event row carries: user_id (null when logged out), anonymous_id,
// and metadata.session_id. First-touch attribution (UTM + referrer) is captured
// once on first visit and attached to landing/signup events via firstTouch().
// ─────────────────────────────────────────────────────────────────────────────

const ANON_KEY    = "beshvili_anon_id";
const SESSION_KEY = "beshvili_session_id";
const ATTR_KEY    = "beshvili_first_touch";

function uuid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

// Persistent across visits — the anonymous identity used to stitch pre-login
// events to a user after they sign up.
function getAnonId() {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) { id = uuid(); localStorage.setItem(ANON_KEY, id); }
    return id;
  } catch { return null; }
}

// Per browser-tab session (resets when the tab/session ends).
function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) { id = uuid(); sessionStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch { return null; }
}

// First-touch attribution — captured ONCE on the first ever visit and frozen.
export function firstTouch() {
  try {
    const existing = localStorage.getItem(ATTR_KEY);
    if (existing) return JSON.parse(existing);
    const p = new URLSearchParams(window.location.search);
    const raw = {
      utm_source:   p.get("utm_source"),
      utm_medium:   p.get("utm_medium"),
      utm_campaign: p.get("utm_campaign"),
      utm_term:     p.get("utm_term"),
      utm_content:  p.get("utm_content"),
      gclid:        p.get("gclid"),
      fbclid:       p.get("fbclid"),
      referrer:     document.referrer || null,
      landing_path: window.location.pathname,
    };
    const ft = Object.fromEntries(Object.entries(raw).filter(([, v]) => v != null && v !== ""));
    localStorage.setItem(ATTR_KEY, JSON.stringify(ft));
    return ft;
  } catch { return {}; }
}

// Capture attribution immediately at module load, before any client-side nav
// can mutate the URL/referrer.
try { firstTouch(); } catch { /* ignore */ }

// Resolve the current user_id from the locally-cached session (no network call).
async function resolveUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch { return null; }
}

// Core emitter. Fire-and-forget; never throws into the caller.
export async function track(event, metadata = {}) {
  try {
    const userId = await resolveUserId();
    await supabase.from("events").insert({
      user_id: userId,                 // null → inserted via the anon RLS policy
      anonymous_id: getAnonId(),
      event,
      metadata: { session_id: getSessionId(), ...metadata },
    });
  } catch { /* analytics must never break the app */ }
}

// Page/route view. Attaches first-touch attribution so traffic sources can be
// attributed to landing views.
export function pageView(route, extra = {}) {
  return track("page_view", { route, ...firstTouch(), ...extra });
}

// Emitted on sign-in to alias the anonymous_id to the now-known user_id, closing
// the loop between the anonymous funnel and the authenticated user.
export function identify(userId, extra = {}) {
  return track("identify", { aliased_user_id: userId, ...extra });
}
