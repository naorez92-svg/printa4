import { useEffect, useState } from "react";
import { track } from "../hooks/useEvents";
import Logo from "../components/Logo";

// /f/:token — the printed booklet's feedback loop, opened by scanning the QR
// on the page. No login: the unguessable share token is the capability. A
// 10-second form ("how did it go?") that feeds the owner's dashboard and the
// corrective-booklet generator.

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL || "https://gywpdzkvkdisonuzhsib.supabase.co"}/functions/v1/record-booklet-result`;

const FILLED_BY = [
  { id: "parent",  label: "הורה",  icon: "🧑‍🦱" },
  { id: "teacher", label: "מורה",  icon: "🍎" },
  { id: "student", label: "תלמיד/ה", icon: "🎒" },
];
const DIFFICULTY = [
  { id: "too_easy",   label: "קל מדי",   icon: "🥱" },
  { id: "just_right", label: "בדיוק",    icon: "🎯" },
  { id: "too_hard",   label: "קשה מדי",  icon: "🥵" },
];
const MISTAKES = [
  { id: "none", label: "בלי טעויות", icon: "🏆" },
  { id: "few",  label: "כמה טעויות", icon: "✏️" },
  { id: "many", label: "הרבה טעויות", icon: "🔁" },
];

function Chip({ selected, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex-1 min-h-[52px] rounded-2xl border-2 px-2 py-2.5 text-sm font-semibold transition-all flex flex-col items-center justify-center gap-0.5 ${
        selected
          ? "border-magic bg-magic/10 text-magic shadow-sm"
          : "border-ink/10 bg-white text-ink/60 hover:border-magic/40"
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function BookletFeedback({ token }) {
  const [info, setInfo]         = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [filledBy, setFilledBy] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [mistakes, setMistakes] = useState(null);
  const [hardText, setHardText] = useState("");
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [sendError, setSendError] = useState(null);

  const loadInfo = () => {
    setLoadError(null);
    fetch(`${FN_BASE}?token=${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? "not_found" : "server")))
      .then(setInfo)
      // "not_found" is terminal; anything else (flaky phone network — the QR's
      // main environment — or a 5xx) gets a retry, not a "was deleted" dead end.
      .catch(e => setLoadError(e.message === "not_found" ? "not_found" : "retry"));
  };
  useEffect(loadInfo, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (info) track("feedback_form_view", { token });
  }, [info, token]);

  const canSubmit = !!filledBy && (difficulty || mistakes || hardText.trim().length > 1) && !sending;

  const submit = async () => {
    if (!canSubmit) return;
    setSending(true);
    setSendError(null);
    try {
      const r = await fetch(FN_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          filled_by: filledBy,
          difficulty,
          mistakes,
          hard_text: hardText.trim() || null,
        }),
      });
      if (!r.ok) {
        const code = (await r.json().catch(() => ({})))?.error;
        throw new Error(code || `HTTP ${r.status}`);
      }
      track("feedback_form_submitted", { token, filledBy, difficulty, mistakes, hasText: !!hardText.trim() });
      setSent(true);
    } catch (e) {
      const code = String(e?.message ?? e);
      track("feedback_form_failed", { token, message: code.slice(0, 100) });
      // Terminal errors get an honest message — "try again" would never succeed.
      setSendError(
        code === "too_many_results" ? "קיבלנו כבר הרבה עדכונים על החוברת הזו — תודה רבה! 🙏"
        : code === "not_found" ? "החוברת כבר לא קיימת במערכת"
        : "לא הצלחנו לשלוח — בדקו את החיבור ונסו שוב 🙏"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-canvas flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <Logo size={28} />
          <span className="font-bold text-ink text-lg font-display">בשבילי<span className="text-brand">·</span></span>
        </div>

        {loadError === "not_found" && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-ink/5 text-center space-y-3">
            <div className="text-5xl">🔍</div>
            <h1 className="font-bold text-ink text-lg">החוברת לא נמצאה</h1>
            <p className="text-sm text-ink/50">יכול להיות שהיא נמחקה. אפשר ליצור חוברת חדשה בחינם:</p>
            <a href="/" className="inline-block bg-gradient-to-l from-magic to-brand text-white rounded-xl px-6 py-3 font-semibold text-sm">✨ לבשבילי</a>
          </div>
        )}
        {loadError === "retry" && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-ink/5 text-center space-y-3">
            <div className="text-5xl">📶</div>
            <h1 className="font-bold text-ink text-lg">בעיית תקשורת</h1>
            <p className="text-sm text-ink/50">בדקו את החיבור לאינטרנט ונסו שוב</p>
            <button onClick={loadInfo} className="inline-block bg-gradient-to-l from-magic to-brand text-white rounded-xl px-6 py-3 font-semibold text-sm">🔄 נסו שוב</button>
          </div>
        )}

        {!loadError && !info && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-ink/5 text-center" role="status" aria-live="polite">
            <div className="inline-block w-6 h-6 border-2 border-ink/15 border-t-magic rounded-full animate-spin" />
            <p className="text-sm text-ink/40 mt-3">טוען...</p>
          </div>
        )}

        {info && sent && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-grow/20 text-center space-y-4 animate-fade-up">
            <div className="text-6xl">🎉</div>
            <h1 className="font-bold text-ink text-xl font-display">תודה! העדכון נשמר</h1>
            <p className="text-sm text-ink/55 leading-relaxed">
              {mistakes === "none"
                ? "כל הכבוד! 🏆 המורה תראה את ההצלחה — והחוברת הבאה תהיה מותאמת בדיוק לרמה."
                : "המורה תראה בדיוק מה היה קשה — והחוברת הבאה תתמקד בזה. ככה משתפרים 💪"}
            </p>
            <a href="/" className="inline-block bg-gradient-to-l from-magic to-brand text-white rounded-xl px-6 py-3 font-semibold text-sm shadow-sm">
              ✨ רוצים חוברת משלכם? חינם
            </a>
          </div>
        )}

        {info && !sent && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-ink/5 space-y-5">
            <div className="text-center">
              <h1 className="font-bold text-ink text-lg font-display leading-snug">איך הלך עם החוברת?</h1>
              <p className="text-xs text-ink/45 mt-1 truncate">「{info.title}」</p>
              <p className="text-[11px] text-magic/70 mt-1.5 font-medium">10 שניות — וזה עוזר להתאים את החוברת הבאה בדיוק</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink/50 mb-2">מי ממלא/ת? *</p>
              <div className="flex gap-2">
                {FILLED_BY.map(o => (
                  <Chip key={o.id} {...o} selected={filledBy === o.id} onClick={() => setFilledBy(o.id)} />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink/50 mb-2">רמת הקושי</p>
              <div className="flex gap-2">
                {DIFFICULTY.map(o => (
                  <Chip key={o.id} {...o} selected={difficulty === o.id} onClick={() => setDifficulty(d => d === o.id ? null : o.id)} />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink/50 mb-2">איך היו הפתרונות?</p>
              <div className="flex gap-2">
                {MISTAKES.map(o => (
                  <Chip key={o.id} {...o} selected={mistakes === o.id} onClick={() => setMistakes(m => m === o.id ? null : o.id)} />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink/50 mb-2">מה היה קשה? (אופציונלי)</p>
              <textarea
                value={hardText}
                onChange={e => setHardText(e.target.value.slice(0, 300))}
                rows={2}
                placeholder={'למשל: "התבלבל בחיסור עם המרה" או "שאלה 4 הייתה קשה"'}
                className="w-full border border-ink/15 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm resize-none"
              />
            </div>

            {sendError && (
              <p role="alert" className="text-red-500 text-sm text-center bg-red-50 border border-red-200 rounded-xl p-2.5">{sendError}</p>
            )}

            <button
              onClick={submit}
              disabled={!canSubmit}
              className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all ${
                canSubmit
                  ? "bg-gradient-to-l from-magic to-brand text-white shadow-lg hover:opacity-90"
                  : "bg-ink/8 text-ink/30 cursor-not-allowed"
              }`}
            >
              {sending
                ? <span className="inline-flex items-center gap-2"><span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />שולח...</span>
                : "שליחה 📬"}
            </button>
            {!filledBy && <p className="text-center text-[11px] text-ink/35">בחרו מי ממלא/ת כדי לשלוח</p>}
          </div>
        )}

        <p className="text-center text-[10px] text-ink/25 mt-4">
          נוצר עם <a href="/" className="underline">beshvili.com</a> — חוברות לימוד אישיות ב-AI
        </p>
      </div>
    </div>
  );
}
