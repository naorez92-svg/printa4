import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useJourney } from "./useJourney";
import Journey from "./Journey";
import Interview from "./Interview";
import Analysis from "./Analysis";
import Report from "./Report";
import { Shell, ProgressHeader, Btn, CompassMark } from "./ui";

// מצפן (Compass) — root of the career-guidance journey app, served at /compass.
// The assessment itself runs without login (answers live in localStorage), so
// the journey starts with zero friction. Login (magic link / Google) is asked
// for only when reaching the AI stages — the Edge Function requires a JWT and
// the report is worth saving to an account anyway.

const AI_STAGES = new Set(["interview", "analysis", "report"]);

export default function CompassApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { journey, update, ensureRow, goToStage, nextStage, saveSection, restart } = useJourney(session);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => { setSession(data.session); setAuthLoading(false); })
      .catch(() => { setSession(null); setAuthLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { stage } = journey;

  if (stage === "welcome") {
    return <Welcome hasProgress={Object.keys(journey.answers).length > 0} onStart={() => goToStage(Object.keys(journey.answers).length > 0 ? resumeStage(journey) : "background")} />;
  }

  // AI stages require auth. Wait for the session check before deciding —
  // otherwise a logged-in user flashes the login screen on every reload.
  if (AI_STAGES.has(stage) && !session) {
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

// If the user paused mid-journey, resume at the stage they left.
function resumeStage(journey) {
  return journey.stage !== "welcome" ? journey.stage : "background";
}

// ── Landing / welcome ──
function Welcome({ hasProgress, onStart }) {
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
          {hasProgress ? "ממשיכים מאיפה שעצרת ←" : "יוצאים למסע ←"}
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

  const friendly = (err) => {
    const msg = (err && err.message) || "";
    if (/failed to fetch|network|fetch/i.test(msg)) return "בעיית תקשורת — בדוק את החיבור ונסה שוב";
    if (/invalid|valid email/i.test(msg)) return "כתובת המייל לא תקינה";
    if (/rate limit|too many|after \d+ second/i.test(msg)) return "נשלחו יותר מדי בקשות — המתן רגע ונסה שוב";
    return "שגיאה בשליחה — נסה שוב";
  };

  const sendLink = async () => {
    if (!email.trim()) return;
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
        <h2 className="text-2xl font-bold font-display mb-2">עצירה קטנה לפני החלק העמוק</h2>
        <p className="text-white/50 max-w-sm mb-8 leading-relaxed">
          מכאן מתחיל הראיון האישי והניתוח שלך. כניסה מהירה במייל — כדי שהמסע והדוח
          יישמרו בחשבונך, מכל מכשיר. בלי סיסמה.
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
