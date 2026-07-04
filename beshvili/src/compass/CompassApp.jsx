import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { track, pageView, identify } from "../hooks/useEvents";
import { useJourney } from "./useJourney";
import Journey from "./Journey";
import Interview from "./Interview";
import Paywall from "./Paywall";
import Analysis from "./Analysis";
import Report from "./Report";
import { Shell, ProgressHeader, Btn, CompassMark } from "./ui";

// מצפן (Compass) — root of the career-guidance journey app, served at /compass.
// Login (magic link / Google) is required right after the welcome screen: every
// user's journey lives in their own account (cross-device resume, the paywall
// entitlement, and the Edge Function's JWT all hang off it). localStorage still
// backs every keystroke so the magic-link redirect never loses progress.

export default function CompassApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { journey, update, ensureRow, goToStage, nextStage, saveSection, restart } = useJourney(session);

  useEffect(() => {
    pageView("compass");
    supabase.auth.getSession()
      .then(({ data }) => { setSession(data.session); setAuthLoading(false); })
      .catch(() => { setSession(null); setAuthLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // Tie the compass funnel to the user identity (once per tab-session —
      // SIGNED_IN also fires on token refresh / tab refocus).
      if (_e === "SIGNED_IN" && s?.user) {
        let counted = false;
        try {
          counted = sessionStorage.getItem("compass_session_counted") === s.user.id;
          sessionStorage.setItem("compass_session_counted", s.user.id);
        } catch { /* ignore */ }
        if (!counted) {
          identify(s.user.id);
          track("compass_login_completed", { method: s.user.app_metadata?.provider ?? "magic_link" });
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { stage } = journey;

  if (stage === "welcome") {
    // Resume happens in loadLocal (a returning user restores at their saved
    // stage and never sees Welcome), so starting always means "background".
    return <Welcome onStart={() => { track("compass_start", {}); goToStage("background"); }} />;
  }

  // Everything past the welcome screen requires auth. Wait for the session
  // check before deciding — otherwise a logged-in user flashes the login
  // screen on every reload.
  if (stage !== "welcome" && !session) {
    if (authLoading) {
      return (
        <Shell>
          <div className="flex-1 flex items-center justify-center">
            <CompassMark size={44} className="animate-spin [animation-duration:3s]" />
          </div>
        </Shell>
      );
    }
    return <CompassLogin />;
  }

  return (
    <Shell wide={stage === "report"}>
      {stage !== "report" && <ProgressHeader stageId={stage} onRestart={() => {
        if (window.confirm("להתחיל את המסע מחדש? כל התשובות יימחקו.")) restart();
      }} />}
      {stage === "interview" ? (
        <Interview journey={journey} update={update} ensureRow={ensureRow} nextStage={nextStage} />
      ) : stage === "paywall" ? (
        <Paywall journey={journey} nextStage={nextStage} />
      ) : stage === "analysis" ? (
        <Analysis journey={journey} update={update} ensureRow={ensureRow} goToStage={goToStage} />
      ) : stage === "report" ? (
        <Report journey={journey} restart={restart} />
      ) : (
        <Journey journey={journey} saveSection={saveSection} nextStage={nextStage} />
      )}
    </Shell>
  );
}

// ── Landing / welcome ──
function Welcome({ onStart }) {
  return (
    <Shell>
      <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
        <CompassMark size={84} className="mb-6" />
        <h1 className="text-5xl font-bold font-display mb-3">מצפן</h1>
        <p className="text-xl text-white/70 mb-2 max-w-md leading-relaxed">
          לא יודע מה ללמוד? מה לעשות בחיים?
        </p>
        <p className="text-white/45 mb-10 max-w-md leading-relaxed">
          מסע עומק אישי — פסיכולוגי ואינטלקטואלי — שבסופו תצא עם תשובה ברורה:
          מה הייעוד שלך, מה בדיוק ללמוד, ואיך מגיעים לשם.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg mb-10 text-right">
          {[
            { icon: "🧭", title: "אבחון עומק", desc: "תשוקות, ערכים, אישיות, יכולות — כלים פסיכולוגיים אמיתיים" },
            { icon: "🎙️", title: "ראיון אישי", desc: "צוות מומחי AI ששואל בדיוק את השאלות הנכונות עליך" },
            { icon: "🗺️", title: "תוצאה ברורה", desc: "ייעוד, מה ללמוד ואיפה, ומפת דרכים עם צעדים" },
          ].map((f) => (
            <div key={f.title} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-bold text-sm mb-1">{f.title}</div>
              <div className="text-xs text-white/45 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>

        <Btn onClick={onStart} className="text-lg px-10 py-4">
          יוצאים למסע ←
        </Btn>
        <p className="text-xs text-white/30 mt-4">
          ‏30–60 דקות · אפשר לעצור ולחזור מתי שרוצים · חינם
        </p>
      </div>
    </Shell>
  );
}

// ── Login gate before the AI stages ──
function CompassLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const redirectTo = `${window.location.origin}/compass`;

  // Same error map as friendlyAuthError in pages/Login.jsx, rephrased for the
  // compass audience (neutral/masculine). Keep the two regexes in sync.
  const friendly = (err) => {
    const msg = (err && err.message) || "";
    if (/failed to fetch|network ?request failed|networkerror|load failed|fetch/i.test(msg)) {
      return "בעיית תקשורת — בדוק את החיבור לאינטרנט ונסה שוב";
    }
    if (/invalid|not a valid email|unable to validate email/i.test(msg)) return "כתובת המייל לא תקינה";
    if (/rate limit|too many/i.test(msg)) return "נשלחו יותר מדי בקשות — המתן רגע ונסה שוב";
    return /[֐-׿]/.test(msg) ? msg : "שגיאה בשליחה — נסה שוב";
  };

  const sendLink = async () => {
    if (!email.trim()) return;
    track("compass_auth_email_submitted", {});
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (err && !(err.status === 429 || /after \d+ second/i.test(err.message || ""))) setError(friendly(err));
    else setSent(true);
  };

  const google = async () => {
    track("compass_auth_google_click", {});
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (err) setError(friendly(err));
  };

  return (
    <Shell>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <CompassMark size={56} className="mb-5" />
        <h2 className="text-2xl font-bold font-display mb-2">רגע לפני שיוצאים לדרך</h2>
        <p className="text-white/50 max-w-sm mb-8 leading-relaxed">
          כניסה מהירה במייל — בלי סיסמה. ככה המסע, התשובות והדוח שלך נשמרים
          בחשבון אישי משלך, ואפשר לעצור ולחזור מכל מכשיר.
        </p>

        <div className="w-full max-w-sm space-y-3">
          {sent ? (
            <div className="bg-white/5 border border-grow/40 rounded-2xl px-5 py-6">
              <p className="font-semibold mb-1">✉️ בדוק את המייל</p>
              <p className="text-sm text-white/50">שלחנו קישור ל־{email}. לחץ עליו — ותחזור בדיוק לכאן.</p>
              <button onClick={() => setSent(false)} className="text-xs text-white/40 underline mt-3 hover:text-white/70">
                שינוי מייל / שליחה מחדש
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={google}
                className="w-full flex items-center justify-center gap-3 bg-white/90 hover:bg-white text-ink rounded-2xl px-4 py-3.5 font-semibold transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                  <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
                  <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                </svg>
                המשך עם Google
              </button>
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-white/10" />
                <span className="text-xs text-white/35">או עם מייל</span>
                <div className="flex-1 border-t border-white/10" />
              </div>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendLink()}
                className="w-full bg-white/5 border border-white/15 rounded-2xl px-4 py-3.5 outline-none focus:border-magic transition-colors text-center"
                placeholder="your@email.com"
              />
              {error && <p className="text-red-300 text-sm">{error}</p>}
              <Btn onClick={sendLink} disabled={loading || !email.trim()} className="w-full">
                {loading ? "שולח…" : "שלחו לי קישור כניסה ✉️"}
              </Btn>
            </>
          )}
        </div>
        <p className="text-xs text-white/25 mt-6">ההתקדמות שלך עד כאן שמורה במכשיר — שום דבר לא הולך לאיבוד.</p>
      </div>
    </Shell>
  );
}
