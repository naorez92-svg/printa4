import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import Preview from "./Preview";
import { FREE_LIMIT } from "../hooks/useProfile";

// Contact link for upgrade — replace with actual WhatsApp/payment link
const UPGRADE_LINK = "https://wa.me/972509139137?text=" + encodeURIComponent("שלום! אני רוצה לשדרג לבשבילי פרו 🎉");

const WORLDS = ["כדורגל", "גיימינג", "חיות", "חלל", "בישול", "מוזיקה", "סוסים", "נינג'ה", "פוקימון", "מינקראפט"];
const LEVELS = [["basic", "🌱 בסיסי"], ["medium", "⚡ בינוני"], ["advanced", "🚀 מתקדם"]];
const TEMPLATES = [
  { icon: "📖", label: "כיתה א — קריאה",    f: { grade: "כיתה א", world: "חיות",    goal: "קריאת מילים בניקוד מלא ומשפטים פשוטים",             level: "basic"    } },
  { icon: "➕", label: "כיתה ב — חיבור",   f: { grade: "כיתה ב", world: "כדורגל", goal: "חיבור וחיסור עד 100 ללא מעבר עשרת",                level: "medium"   } },
  { icon: "✖️", label: "כיתה ג — כפל",     f: { grade: "כיתה ג", world: "גיימינג", goal: "לוח כפל 6, 7, 8 — שינון ויישום",                  level: "medium"   } },
  { icon: "½",  label: "כיתה ד — שברים",   f: { grade: "כיתה ד", world: "חלל",    goal: "שברים: חצי, שליש, רבע — זיהוי, חיבור, השוואה",    level: "medium"   } },
  { icon: "📐", label: "כיתה ה — שטח",     f: { grade: "כיתה ה", world: "בישול",  goal: "שטח והיקף: ריבוע, מלבן, משולש",                    level: "advanced" } },
  { icon: "%",  label: "כיתה ו — אחוזים",  f: { grade: "כיתה ו", world: "מוזיקה", goal: "אחוזים: חישוב, הסקה, בעיות מילוליות",              level: "advanced" } },
  { icon: "📝", label: "מבחן חצי שנתי",    f: { grade: "",        world: "כללי",   goal: "מבחן חצי שנתי: חשבון, שפה, הבנת הנקרא",            level: "advanced" } },
  { icon: "🔄", label: "חזרה לפני בחינה",  f: { grade: "",        world: "גיימינג",goal: "חזרה כללית: ארבע פעולות, שברים, אחוזים, בעיות",   level: "medium"   } },
  { icon: "🌟", label: "העשרה מתקדמת",     f: { grade: "",        world: "חלל",    goal: "חשיבה מתמטית: פאזלים, לוגיקה, חשיבה מחוץ לקופסה", level: "advanced" } },
];
const EMPTY = { childName: "", grade: "", world: "כדורגל", goal: "", level: "medium" };
const PAGE_OPTIONS = [3, 5, 7, 10];
const LOADING_MSGS = [
  "קורא את הבקשה שלך...",
  "מתכנן את מבנה החוברת...",
  "כותב תרגילים ומשימות...",
  "מעצב עמודי A4...",
  "מוסיף צבעים ואימוג'ים...",
  "עוד קצת בסבלנות, זה כבר בדרך...",
  "בודק איכות ומסיים...",
  "כמעט מוכן! עוד רגע...",
];

export default function Create({ onSaved, remaining, isPro }) {
  const [mode, setMode]           = useState("form");
  const [f, setF]                 = useState(EMPTY);
  const [freeText, setFreeText]   = useState("");
  const [pageCount, setPageCount] = useState(5);
  const [withAnswerKey, setWithAnswerKey] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [streamChars, setStreamChars] = useState(0);
  const [html, setHtml]           = useState(null);
  const [error, setError]         = useState(null); // null | "quota" | "rate:{wait}" | "generic:{msg}"

  // Rotate loading messages every 3.5 s while generating
  useEffect(() => {
    if (!loading) { setLoadingMsgIdx(0); setStreamChars(0); return; }
    const id = setInterval(() => setLoadingMsgIdx(i => (i + 1) % LOADING_MSGS.length), 3500);
    return () => clearInterval(id);
  }, [loading]);

  const canSubmit = !loading && (mode === "free" ? freeText.trim().length > 5 : f.childName.trim() && f.goal.trim());

  const create = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setHtml(null);
    setError(null);

    const body = mode === "free"
      ? { freeText: freeText.trim(), pageCount, withAnswerKey }
      : { ...f, pageCount, withAnswerKey };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      setError("generic:אתה לא מחובר — נסה להתחבר מחדש");
      return;
    }

    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-booklet?apikey=${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
    let resp;
    try {
      resp = await fetch(fnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
    } catch (e) {
      setLoading(false);
      setError(`generic:שגיאת רשת — ${String(e)}`);
      return;
    }

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const code = errData?.error;
      setLoading(false);
      if (code === "quota_exceeded") { setError("quota"); return; }
      if (code === "rate_limited")   { setError(`rate:${errData?.wait ?? 60}`); return; }
      setError(`generic:${code || `שגיאת שרת ${resp.status}`}`);
      return;
    }

    // Read SSE stream — Anthropic sends content_block_delta events with text chunks
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let htmlAccumulated = "";
    let updateTimer = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const ev = JSON.parse(raw);
            if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
              htmlAccumulated += ev.delta.text;
              // Throttle React state updates to ~10fps
              const now = Date.now();
              if (now - updateTimer > 100) {
                setStreamChars(htmlAccumulated.length);
                updateTimer = now;
              }
            }
          } catch {}
        }
      }
    } catch (streamErr) {
      setLoading(false);
      setError("generic:שגיאה בקבלת הנתונים מהשרת");
      return;
    }

    setLoading(false);

    const html = htmlAccumulated.trim();
    if (!html || !html.includes("<")) { setError("generic:לא התקבל HTML תקין מהשרת"); return; }

    const title = mode === "free"
      ? freeText.trim().substring(0, 60) + (freeText.length > 60 ? "…" : "")
      : `${f.childName} — ${f.goal}`;

    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) { setError("generic:שגיאת משתמש — נסה להתחבר מחדש"); return; }

    const { error: insertErr } = await supabase.from("booklets").insert({
      user_id: u.user.id, title,
      child_name: f.childName || null, grade: f.grade || null,
      world: f.world || null,
      goal: mode === "free" ? freeText.trim().substring(0, 200) : f.goal,
      level: f.level, html,
    });
    if (insertErr) { setError(`generic:שמירה נכשלה — ${insertErr.message}`); return; }

    setHtml(html);
    onSaved?.();
  }, [canSubmit, mode, freeText, f, pageCount, withAnswerKey, onSaved]);

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") create(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [create]);

  const reset = () => { setHtml(null); setF(EMPTY); setFreeText(""); setError(null); };
  const set   = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const applyTmpl = (tmpl) => { setF((p) => ({ ...p, ...tmpl.f })); setMode("form"); setTimeout(() => document.getElementById("inp-name")?.focus(), 50); };

  // ── Quota exceeded screen ──────────────────────────────────────────────────
  if (error === "quota") {
    return (
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-ink/5 text-center space-y-5">
        <div className="text-5xl">🔒</div>
        <div>
          <h2 className="text-xl font-bold text-ink mb-1">ניצלת את {FREE_LIMIT} החוברות החינמיות!</h2>
          <p className="text-ink/60 text-sm">שדרג לפרו וקבל חוברות ללא הגבלה — 30 ₪/חודש בלבד</p>
        </div>

        <div className="bg-canvas rounded-2xl p-4 space-y-2 text-right">
          {["חוברות ללא הגבלה", "עד 20 עמודים בחוברת", "מפתח תשובות אוטומטי", "שמירה בענן — גישה מכל מכשיר", "תמיכה אישית"].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-ink/70">
              <span className="text-grow">✓</span> {f}
            </div>
          ))}
        </div>

        <a
          href={UPGRADE_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3.5 font-display font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          💬 שדרג עכשיו — 30 ₪/חודש
        </a>
        <button onClick={() => setError(null)} className="text-xs text-ink/30 hover:text-ink/50 underline">
          חזור (למי שכבר שדרג)
        </button>
      </section>
    );
  }

  // ── Generated ──────────────────────────────────────────────────────────────
  if (html) {
    return (
      <section className="space-y-4 bg-white rounded-2xl p-5 shadow-sm border border-green-100">
        <div className="flex items-center gap-2 text-green-700 font-medium">
          <span className="text-xl">✅</span>
          <span>החוברת נוצרה ונשמרה בענן!</span>
          {!isPro && remaining !== undefined && (
            <span className="mr-auto text-xs text-ink/40">{remaining} חוברות חינם נותרו</span>
          )}
        </div>
        <Preview html={html} onReset={reset} />
      </section>
    );
  }

  // ── Rate limited ───────────────────────────────────────────────────────────
  const rateWait = error?.startsWith("rate:") ? parseInt(error.split(":")[1]) : null;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-ink/5 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-l from-magic/10 to-brand/10 px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">✨ חוברת חדשה</h2>
          {!isPro && remaining === 0 && (
            <span className="text-xs text-red-500 font-medium">נגמרה המכסה החינמית</span>
          )}
        </div>
        <div className="flex gap-1 bg-white/70 rounded-xl p-1 w-fit">
          {[["form", "📋 טופס"], ["free", "✍️ טקסט חופשי"]].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === m ? "bg-white shadow text-ink" : "text-ink/50 hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Templates */}
        <div>
          <p className="text-xs text-ink/40 mb-2 font-medium uppercase tracking-wide">תבניות מהירות</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {TEMPLATES.map((t) => (
              <button key={t.label} onClick={() => applyTmpl(t)}
                className="flex-shrink-0 border border-ink/15 rounded-full px-3 py-1 text-xs text-ink/70 hover:border-magic hover:text-magic transition-colors whitespace-nowrap">
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-ink/5" />

        {/* Form mode */}
        {mode === "form" && (
          <div className="space-y-3">
            <input id="inp-name" className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50" placeholder="שם הילד/ה *" value={f.childName} onChange={set("childName")} disabled={loading} />
            <input className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50" placeholder="גיל / כיתה" value={f.grade} onChange={set("grade")} disabled={loading} />
            <select className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic bg-canvas/50 text-right" value={f.world} onChange={set("world")} disabled={loading}>
              {WORLDS.map((w) => <option key={w}>{w}</option>)}
            </select>
            <textarea className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none bg-canvas/50" placeholder="יעד פדגוגי *" rows={2} value={f.goal} onChange={set("goal")} disabled={loading} />
            <div className="flex gap-2">
              {LEVELS.map(([v, t]) => (
                <button key={v} onClick={() => setF((p) => ({ ...p, level: v }))} disabled={loading}
                  className={`flex-1 rounded-xl p-2 text-sm font-medium border transition-colors ${f.level === v ? "bg-magic text-white border-magic shadow-sm" : "bg-canvas/50 border-ink/15 text-ink/60 hover:border-magic/50"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Free text mode */}
        {mode === "free" && (
          <textarea
            className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none bg-canvas/50 leading-relaxed"
            placeholder={"דוגמאות:\n• \"דניאל, כיתה ד, אוהב כדורסל — תרגול שברים\"\n• \"מבחן חצי שנתי לכיתה ה' בחשבון ובשפה\"\n• \"חוברת חזרה לפני בחינה — ארבע פעולות\""}
            rows={6} value={freeText} onChange={(e) => setFreeText(e.target.value)} disabled={loading} autoFocus
          />
        )}

        <div className="border-t border-ink/5" />

        {/* Page count selector */}
        <div>
          <p className="text-xs text-ink/40 mb-2 font-medium">כמות עמודים</p>
          <div className="flex gap-2">
            {PAGE_OPTIONS.map((n) => (
              <button key={n} onClick={() => setPageCount(n)} disabled={loading}
                className={`flex-1 rounded-xl p-2 text-sm font-medium border transition-colors ${pageCount === n ? "bg-brand text-white border-brand shadow-sm" : "bg-canvas/50 border-ink/15 text-ink/60 hover:border-brand/50"}`}>
                {n} עמ'
              </button>
            ))}
          </div>
        </div>

        {/* Answer key toggle */}
        <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
          <div>
            <span className="text-sm font-medium text-ink">מפתח תשובות</span>
            <span className="text-xs text-ink/40 mr-2">דף תשובות בסוף החוברת</span>
          </div>
          <div
            onClick={() => !loading && setWithAnswerKey(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${withAnswerKey ? "bg-magic" : "bg-ink/20"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${withAnswerKey ? "right-0.5" : "left-0.5"}`} />
          </div>
        </label>

        {/* Rate limit error */}
        {rateWait && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-sm text-center">
            ⏳ יש להמתין עוד {rateWait} שניות לפני יצירה נוספת
          </div>
        )}

        {/* Generic error */}
        {error?.startsWith("generic:") && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
            {error.replace("generic:", "")}
          </div>
        )}

        {/* Submit / loading */}
        {loading ? (
          <div className="text-center py-8 space-y-3">
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full bg-magic animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="text-ink/60 text-sm font-medium">{LOADING_MSGS[loadingMsgIdx]}</p>
            {streamChars > 0
              ? <p className="text-magic text-xs font-mono">{streamChars.toLocaleString("he-IL")} תווים נכתבו...</p>
              : <p className="text-ink/30 text-xs">{pageCount} עמודי A4 · 30–90 שניות</p>
            }
            <div className="w-full bg-canvas rounded-full h-1.5 overflow-hidden">
              {streamChars > 0
                ? <div className="h-full bg-gradient-to-r from-brand via-magic to-grow rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(95, (streamChars / (pageCount * 3200)) * 100)}%` }} />
                : <div className="h-full bg-gradient-to-r from-brand via-magic to-grow rounded-full animate-shimmer" />
              }
            </div>
          </div>
        ) : (
          <button onClick={create} disabled={!canSubmit || (!isPro && remaining === 0)}
            className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3.5 font-display font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity shadow-sm">
            {(!isPro && remaining === 0) ? "🔒 שדרג לפרו להמשיך" : `✨ צור חוברת (${pageCount} עמ')`}
            {canSubmit && <span className="mr-2 text-white/60 text-xs font-normal">Ctrl+Enter</span>}
          </button>
        )}
      </div>
    </section>
  );
}
