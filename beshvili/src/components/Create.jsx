import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import Preview from "./Preview";

const WORLDS = ["כדורגל", "גיימינג", "חיות", "חלל", "בישול", "מוזיקה", "סוסים", "נינג'ה", "פוקימון", "מינקראפט"];

const LEVELS = [
  ["basic",    "🌱 בסיסי"],
  ["medium",   "⚡ בינוני"],
  ["advanced", "🚀 מתקדם"],
];

const TEMPLATES = [
  { icon: "📖", label: "כיתה א — קריאה",       f: { childName: "", grade: "כיתה א", world: "חיות",    goal: "קריאת מילים בניקוד מלא ומשפטים פשוטים", level: "basic"    } },
  { icon: "➕", label: "כיתה ב — חיבור",        f: { childName: "", grade: "כיתה ב", world: "כדורגל", goal: "חיבור וחיסור עד 100 ללא מעבר עשרת", level: "medium"   } },
  { icon: "✖️", label: "כיתה ג — כפל",           f: { childName: "", grade: "כיתה ג", world: "גיימינג", goal: "לוח כפל 6, 7, 8 — שינון ויישום", level: "medium"   } },
  { icon: "½",  label: "כיתה ד — שברים",         f: { childName: "", grade: "כיתה ד", world: "חלל",    goal: "שברים: חצי, שליש, רבע — זיהוי, חיבור, השוואה", level: "medium"   } },
  { icon: "📐", label: "כיתה ה — שטח",           f: { childName: "", grade: "כיתה ה", world: "בישול",  goal: "שטח והיקף: ריבוע, מלבן, משולש — נוסחאות ותרגילים", level: "advanced" } },
  { icon: "%",  label: "כיתה ו — אחוזים",        f: { childName: "", grade: "כיתה ו", world: "מוזיקה", goal: "אחוזים: חישוב, הסקה, בעיות מילוליות", level: "advanced" } },
  { icon: "📝", label: "מבחן חצי שנתי",          f: { childName: "", grade: "",        world: "כללי",   goal: "מבחן חצי שנתי: חשבון ושפה — ארבע פעולות, הבנת הנקרא, כתיבה", level: "advanced" } },
  { icon: "🔄", label: "חזרה לפני בחינה",        f: { childName: "", grade: "",        world: "גיימינג", goal: "חזרה כללית על כל החומר: ארבע פעולות, שברים, אחוזים, בעיות מילוליות", level: "medium"   } },
  { icon: "🌟", label: "העשרה מתקדמת",           f: { childName: "", grade: "",        world: "חלל",    goal: "חשיבה מתמטית מתקדמת: פאזלים, בעיות לוגיות, חשיבה מחוץ לקופסה", level: "advanced" } },
];

const EMPTY_FORM = { childName: "", grade: "", world: "כדורגל", goal: "", level: "medium" };

export default function Create({ onSaved }) {
  const [mode, setMode] = useState("form"); // "form" | "free"
  const [f, setF] = useState(EMPTY_FORM);
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState(null);
  const [error, setError] = useState("");

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const canSubmit = mode === "free"
    ? freeText.trim().length > 5
    : f.childName.trim() && f.goal.trim();

  const create = useCallback(async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setHtml(null);
    setError("");

    const body = mode === "free"
      ? { freeText: freeText.trim() }
      : { ...f };

    const { data, error: fnErr } = await supabase.functions.invoke("generate-booklet", { body });

    if (fnErr || !data?.html) {
      setLoading(false);
      setError(fnErr?.message || "שגיאה ביצירת החוברת — בדוק שה-Edge Function פרוסה.");
      return;
    }

    const title = mode === "free"
      ? freeText.trim().substring(0, 60) + (freeText.length > 60 ? "…" : "")
      : `${f.childName} — ${f.goal}`;

    const { data: u } = await supabase.auth.getUser();
    await supabase.from("booklets").insert({
      user_id: u.user.id,
      title,
      child_name: f.childName || null,
      grade: f.grade || null,
      world: f.world || null,
      goal: mode === "free" ? freeText.trim().substring(0, 200) : f.goal,
      level: f.level,
      html: data.html,
    });

    setHtml(data.html);
    setLoading(false);
    onSaved?.();
  }, [canSubmit, loading, mode, freeText, f, onSaved]);

  // ⌨️ Ctrl+Enter to generate
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") create();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [create]);

  const reset = () => { setHtml(null); setF(EMPTY_FORM); setFreeText(""); setError(""); };

  const applyTemplate = (tmpl) => {
    setF((prev) => ({ ...prev, ...tmpl.f }));
    setMode("form");
    // scroll to name input
    setTimeout(() => document.getElementById("inp-name")?.focus(), 50);
  };

  if (html) {
    return (
      <section className="space-y-4 bg-white rounded-2xl p-5 shadow-sm border border-green-100">
        <div className="flex items-center gap-2 text-green-700 font-medium">
          <span className="text-xl">✅</span>
          <span>החוברת נוצרה ונשמרה בענן!</span>
        </div>
        <Preview html={html} onReset={reset} />
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-ink/5 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-l from-magic/10 to-brand/10 px-5 pt-5 pb-4">
        <h2 className="text-xl font-semibold mb-3">✨ חוברת חדשה</h2>

        {/* Mode tabs */}
        <div className="flex gap-1 bg-white/70 rounded-xl p-1 w-fit">
          {[["form", "📋 טופס"], ["free", "✍️ טקסט חופשי"]].map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mode === m ? "bg-white shadow text-ink" : "text-ink/50 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Quick templates */}
        <div>
          <p className="text-xs text-ink/40 mb-2 font-medium uppercase tracking-wide">תבניות מהירות</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => applyTemplate(t)}
                className="flex-shrink-0 border border-ink/15 rounded-full px-3 py-1 text-xs text-ink/70 hover:border-magic hover:text-magic transition-colors whitespace-nowrap"
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-ink/5" />

        {/* Form Mode */}
        {mode === "form" && (
          <div className="space-y-3">
            <input
              id="inp-name"
              className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50"
              placeholder="שם הילד/ה *"
              value={f.childName}
              onChange={set("childName")}
              disabled={loading}
            />
            <input
              className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50"
              placeholder="גיל / כיתה (למשל: כיתה ג, 9 שנים)"
              value={f.grade}
              onChange={set("grade")}
              disabled={loading}
            />
            <div>
              <label className="block text-xs text-ink/50 mb-1 font-medium">עולם תוכן אהוב</label>
              <select
                className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic bg-canvas/50 text-right"
                value={f.world}
                onChange={set("world")}
                disabled={loading}
              >
                {WORLDS.map((w) => <option key={w}>{w}</option>)}
              </select>
            </div>
            <textarea
              className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none bg-canvas/50"
              placeholder="יעד פדגוגי * (למשל: חיבור וחיסור עד 100, לוח כפל 6-8, קריאת שעון…)"
              rows={2}
              value={f.goal}
              onChange={set("goal")}
              disabled={loading}
            />
            <div className="flex gap-2">
              {LEVELS.map(([v, t]) => (
                <button
                  key={v}
                  onClick={() => setF((p) => ({ ...p, level: v }))}
                  disabled={loading}
                  className={`flex-1 rounded-xl p-2 text-sm font-medium border transition-colors ${
                    f.level === v
                      ? "bg-magic text-white border-magic shadow-sm"
                      : "bg-canvas/50 border-ink/15 text-ink/60 hover:border-magic/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Free Text Mode */}
        {mode === "free" && (
          <div className="space-y-2">
            <p className="text-xs text-ink/50">
              תאר בחופשיות מה אתה רוצה — Claude יבנה חוברת A4 מלאה מהטקסט שלך.
            </p>
            <textarea
              className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none bg-canvas/50 leading-relaxed"
              placeholder={'דוגמאות:\n• "דניאל, כיתה ד, אוהב כדורסל — תרגול שברים"\n• "מבחן חצי שנתי לכיתה ה\' בחשבון ובשפה"\n• "חוברת חזרה לפני בחינה — ארבע פעולות ובעיות מילוליות"\n• "חוברת קיץ לכיתה ב עם הרבה ציורים"'}
              rows={6}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 space-y-3">
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-magic animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-ink/50 text-sm">Claude מייצר 5 עמודי A4… (30–90 שניות)</p>
            <div className="w-full bg-canvas rounded-full h-1 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand via-magic to-grow rounded-full animate-shimmer" style={{ backgroundSize: "200% 100%" }} />
            </div>
            <p className="text-xs text-ink/30">⌨️ Ctrl+Enter בפעם הבאה</p>
          </div>
        ) : (
          <button
            onClick={create}
            disabled={!canSubmit}
            className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3.5 font-display font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity shadow-sm"
          >
            ✨ צור חוברת
            <span className="mr-2 text-white/60 text-xs font-normal">Ctrl+Enter</span>
          </button>
        )}
      </div>
    </section>
  );
}
