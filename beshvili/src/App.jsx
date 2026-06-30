import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "./lib/supabase";
import AccessibilityWidget from "./components/AccessibilityWidget";
import InAppBrowserBanner from "./components/InAppBrowserBanner";
import { track, pageView, identify } from "./hooks/useEvents";

// Route-level code splitting: Login (marketing + auth), Dashboard (the entire
// authed app — Create/Jewish/Students/Admin/…), and PublicBooklet load on demand.
// A logged-out visitor no longer downloads the Dashboard tree; a /b/:token visitor
// downloads neither Login nor Dashboard. Cuts the landing first-paint bundle ~40%.
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PublicBooklet = lazy(() => import("./pages/PublicBooklet"));

// /b/:token — public booklet share page (no auth needed)
const shareMatch = window.location.pathname.match(/^\/b\/([0-9a-f-]{36})$/i);

// Full-screen loading spinner — reused for the session check AND the lazy-chunk
// fetch so there's no second, differently-styled flash between the two.
const PageSpinner = (
  <div className="min-h-screen bg-canvas flex items-center justify-center" dir="rtl">
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-2.5 h-2.5 rounded-full bg-magic animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  </div>
);

function AuthApp() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    }).catch(() => {
      // Never leave the user stuck on the loading spinner if the session lookup
      // rejects (network blip / storage error) — fall through to the login screen.
      setSession(null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (_e === "SIGNED_IN" && s?.user) {
        // supabase fires SIGNED_IN on token refresh / tab-refocus / reload too,
        // not just real logins. Count once per tab-session (sessionStorage
        // survives reloads within a tab, resets per tab) to avoid inflation.
        let alreadyCounted = false;
        try {
          alreadyCounted = sessionStorage.getItem("beshvili_session_counted") === s.user.id;
          sessionStorage.setItem("beshvili_session_counted", s.user.id);
        } catch { /* ignore */ }
        if (alreadyCounted) return;

        track("session_start", {});
        identify(s.user.id);
        // Distinguish first-ever signup from a returning login (no extra query —
        // the auth user carries created_at).
        const createdMs = new Date(s.user.created_at).getTime();
        const isNew = Number.isFinite(createdMs) && Date.now() - createdMs < 2 * 60 * 1000;
        track(isNew ? "signup_completed" : "login_completed", {
          method: s.user.app_metadata?.provider ?? "magic_link",
        });
      } else if (_e === "SIGNED_OUT") {
        try { sessionStorage.removeItem("beshvili_session_counted"); } catch { /* ignore */ }
        track("sign_out", {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Landing vs app page-view — fired once after the session resolves.
  useEffect(() => {
    if (loading) return;
    pageView(session ? "app" : "landing");
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Active-day signal: fire once per calendar day per device for a logged-in user.
  // session_start is deduped per browser tab, so it can't measure "came back on a
  // later day" — the literal definition of a returning user (the cohort we need to
  // understand the 1→2 booklet drop-off). The localStorage date-gate makes this
  // idempotent even though `session` changes identity on every token refresh.
  useEffect(() => {
    if (loading || !session?.user) return;
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      if (localStorage.getItem("beshvili_active_day") !== today) {
        localStorage.setItem("beshvili_active_day", today);
        track("app_day_active", {});
      }
    } catch { /* storage blocked — skip */ }
  }, [loading, session]);

  if (loading) return PageSpinner;
  return (
    <Suspense fallback={PageSpinner}>
      {session ? <Dashboard /> : <Login />}
    </Suspense>
  );
}

export default function App() {
  return (
    <>
      <InAppBrowserBanner />
      {shareMatch ? (
        <Suspense fallback={PageSpinner}>
          <PublicBooklet token={shareMatch[1]} />
        </Suspense>
      ) : (
        <AuthApp />
      )}
      <AccessibilityWidget />
    </>
  );
}
