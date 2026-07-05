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
        <Report journey={journey} restart={restart} update={update} />
      ) : (
        <Journey journey={journey} saveSection={saveSection} nextStage={nextStage} />
      )}
    </Shell>
  );
}

// ── Landing / welcome ──

// A peek at the real product — mock report cards in the exact visual language
// of the final report (honest preview, not testimonials).
const PREVIEW_CARDS = [
  {
    id: "direction",
    label: "ככה נראה כיוון בדוח שלך",
    node: (
      <div className="text-right">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] bg-brand text-ink rounded-full px-2 py-0.5 font-bold">ההתאמה הגבוהה ביותר</span>
          <div className="flex items-center gap-1.5" dir="ltr">
            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-[92%] bg-gradient-to-r from-magic to-brand" />
            </div>
            <span className="text-xs font-bold text-brand">92%</span>
          </div>
        </div>
        <p className="font-bold mb-1.5">כיוון מס׳ 1 — מותאם אליך</p>
        <p className="text-xs text-white/55 leading-relaxed">
          למה דווקא אתה מתאים לזה, איך נראה יום-יום בתפקיד, טווח שכר ריאלי
          בישראל — וגם המחיר שכדאי להכיר מראש.
        </p>
      </div>
    ),
  },
  {
    id: "roadmap",
    label: "מפת דרכים שהופכת למשימות",
    node: (
      <div className="text-right">
        <p className="font-bold mb-2.5">🗺️ מסלול הפעולה החי שלך</p>
        {[
          { t: "לקבוע שיחה עם בוגר בתחום", done: true },
          { t: "להירשם לקורס מבוא (חינמי)", done: true },
          { t: "להגיש מועמדות ראשונה", done: false },
        ].map((s) => (
          <div key={s.t} className="flex items-center gap-2 text-xs mb-1.5">
            <span className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${s.done ? "bg-grow border-grow text-ink font-bold" : "border-white/25"}`}>
              {s.done ? "✓" : ""}
            </span>
            <span className={s.done ? "text-white/40 line-through" : "text-white/70"}>{s.t}</span>
          </div>
        ))}
        <p className="text-[10px] text-grow mt-2">67% מהדרך — הדוח מתעדכן איתך</p>
      </div>
    ),
  },
  {
    id: "letter",
    label: "והמכתב שכולם קוראים פעמיים",
    node: (
      <div className="text-right">
        <p className="text-xs text-white/40 mb-2">✉️ מכתב אישי, ממצפן אליך</p>
        <p className="text-sm italic text-white/70 leading-relaxed">
          "ראיתי אצלך משהו שאתה אולי עוד לא רואה: הדפוס שחוזר בכל תשובה
          שכתבת. ברגעים של ספק, תחזור למשפט הזה…"
        </p>
      </div>
    ),
  },
];

function Welcome({ onStart }) {
  const [slide, setSlide] = useState(0);
  const [clock, setClock] = useState(0); // bumped by manual dot clicks — restarts the interval

  // Auto-advance the preview carousel. Honors reduced-motion (WCAG 2.3.3 /
  // IS 5568): when the OS asks for less motion, slides only change on tap.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % PREVIEW_CARDS.length), 4000);
    return () => clearInterval(t);
  }, [clock]);
  const goTo = (i) => { setClock((c) => c + 1); setSlide(i); };

  return (
    <Shell>
      <div className="flex-1 flex flex-col items-center text-center pt-10 pb-6">
        {/* Hero — the compass breathes */}
        <div className="relative mb-6">
          <div className="absolute inset-0 -m-6 rounded-full bg-magic/25 blur-2xl animate-pulse [animation-duration:4s]" />
          <CompassMark size={92} className="relative animate-[spinSlow_24s_linear_infinite]" />
        </div>
        <h1 className="text-5xl font-bold font-display mb-3 bg-gradient-to-l from-brand via-white to-magic bg-clip-text text-transparent">
          מצפן
        </h1>
        <p className="text-xl text-white/75 mb-2 max-w-md leading-relaxed font-semibold">
          לא יודע מה ללמוד? מה לעשות בחיים?
        </p>
        <p className="text-white/45 mb-8 max-w-md leading-relaxed">
          מסע עומק פסיכולוגי ואינטלקטואלי, עם צוות מומחי AI שמנתח רק אותך —
          ובסופו תשובה ברורה: הייעוד, מה בדיוק ללמוד, ומפת דרכים חיה שמלווה
          אותך גם אחרי.
        </p>

        <Btn onClick={onStart} className="text-lg px-10 py-4 mb-2 animate-[fadeIn_0.6s_ease]">
          יוצאים למסע ←
        </Btn>
        <p className="text-xs text-white/30 mb-10">
          ‏30–60 דקות · אפשר לעצור ולחזור מתי שרוצים · המסע חינם
        </p>

        {/* Live preview carousel — the actual report, not promises */}
        <div className="w-full max-w-md mb-3">
          <p className="text-xs font-semibold text-magic mb-3">🔍 ככה נראה הדוח שמחכה לך בסוף</p>
          <div className="overflow-hidden rounded-3xl border border-magic/25 bg-white/5">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(${slide * 100}%)` }}
            >
              {PREVIEW_CARDS.map((c) => (
                <div key={c.id} className="w-full flex-shrink-0 p-5">
                  {c.node}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            {PREVIEW_CARDS.map((c, i) => (
              <button
                key={c.id}
                onClick={() => goTo(i)}
                aria-label={c.label}
                className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-brand" : "w-1.5 bg-white/25 hover:bg-white/40"}`}
              />
            ))}
          </div>
          <p className="text-[11px] text-white/35 mt-2 min-h-[1em]">{PREVIEW_CARDS[slide].label}</p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg mb-8 text-right">
          {[
            { n: "1", title: "מסע היכרות", desc: "תשוקות, ערכים, אישיות ויכולות — כלים פסיכולוגיים אמיתיים, לא עוד 'איזה חיה אתה'" },
            { n: "2", title: "ראיון אישי", desc: "מומחה AI שקרא הכל ושואל בדיוק את השאלות שנוגעות בך" },
            { n: "3", title: "המצפן שלך", desc: "דוח עומק: ייעוד, 3 כיוונים מדורגים, מה ללמוד, ומפת דרכים שחיה איתך" },
          ].map((f) => (
            <div key={f.n} className="bg-white/5 border border-white/10 rounded-2xl p-4 relative overflow-hidden">
              <span className="absolute -top-2 left-2 text-5xl font-display font-bold text-white/5 select-none">{f.n}</span>
              <div className="font-bold text-sm mb-1 text-brand">{f.title}</div>
              <div className="text-xs text-white/45 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Trust + legal */}
        <p className="text-[11px] text-white/30 mb-4 max-w-sm leading-relaxed">
          🔒 המסע שלך פרטי. הנתונים משמשים רק להפקת הדוח שלך — לא נמכרים ולא
          משותפים. <a href="/privacy" className="underline hover:text-white/60">מדיניות הפרטיות</a>
        </p>
        <nav className="flex items-center gap-4 text-[11px] text-white/25">
          <a href="/terms" className="hover:text-white/50 transition-colors">תקנון</a>
          <span>·</span>
          <a href="/privacy" className="hover:text-white/50 transition-colors">פרטיות</a>
          <span>·</span>
          <a href="https://wa.me/972509139137" target="_blank" rel="noreferrer" className="hover:text-white/50 transition-colors">צור קשר</a>
        </nav>
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
  // Standalone site — auth always returns to our own origin, never to beshvili.
  const redirectTo = `${window.location.origin}/`;

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
        <p className="text-[11px] text-white/25 mt-3 max-w-xs leading-relaxed">
          בהתחברות אתה מאשר את{" "}
          <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:text-white/50">התקנון</a>
          {" "}ואת{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-white/50">מדיניות הפרטיות</a>
        </p>
      </div>
    </Shell>
  );
}
