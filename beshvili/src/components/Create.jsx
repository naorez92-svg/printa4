import { useState } from "react";
import { supabase } from "../lib/supabase";
import Preview from "./Preview";

const WORLDS = ["כדורגל", "גיימינג", "חיות", "חלל", "בישול", "מוזיקה", "סוסים", "נינג'ה"];
const LEVELS = [
  ["basic", "🌱 בסיסי"],
  ["medium", "⚡ בינוני"],
  ["advanced", "🚀 מתקדם"],
];

const EMPTY = { childName: "", grade: "", world: "כדורגל", goal: "", level: "medium" };

export default function Create({ onSaved }) {
  const [f, setF] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState(null);
  const [error, setError] = useState("");

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const create = async () => {
    setLoading(true);
    setHtml(null);
    setError("");

    const { data, error: fnErr } = await supabase.functions.invoke("generate-booklet", {
      body: f,
    });

    if (fnErr || !data?.html) {
      setLoading(false);
      setError(fnErr?.message || "שגיאה ביצירת החוברת — בדוק שה-Edge Function פרוסה.");
      return;
    }

    const { data: u } = await supabase.auth.getUser();
    await supabase.from("booklets").insert({
      user_id: u.user.id,
      title: `${f.childName} — ${f.goal}`,
      child_name: f.childName,
      grade: f.grade,
      world: f.world,
      goal: f.goal,
      level: f.level,
      html: data.html,
    });

    setHtml(data.html);
    setLoading(false);
    onSaved?.();
  };

  const reset = () => { setHtml(null); setF(EMPTY); setError(""); };

  return (
    <section className="space-y-3 bg-white rounded-2xl p-5 shadow-sm border border-ink/5">
      <h2 className="text-xl font-semibold">חוברת חדשה</h2>

      {!html ? (
        <>
          <input
            className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right"
            placeholder="שם הילד/ה *"
            value={f.childName}
            onChange={set("childName")}
            disabled={loading}
          />
          <input
            className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right"
            placeholder="גיל / כיתה (למשל: כיתה ג, 9 שנים)"
            value={f.grade}
            onChange={set("grade")}
            disabled={loading}
          />

          <div>
            <label className="block text-sm text-ink/60 mb-1">עולם תוכן אהוב</label>
            <select
              className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic bg-white text-right"
              value={f.world}
              onChange={set("world")}
              disabled={loading}
            >
              {WORLDS.map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>

          <textarea
            className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none"
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
                    ? "bg-magic text-white border-magic"
                    : "bg-canvas border-ink/20 text-ink/70 hover:border-magic/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-6 space-y-3">
              <div className="text-3xl animate-spin inline-block">⚙️</div>
              <p className="text-ink/60 text-sm">Claude מייצר את החוברת… (30–90 שניות)</p>
              <div className="w-full bg-canvas rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand via-magic to-grow animate-pulse rounded-full" />
              </div>
            </div>
          ) : (
            <button
              onClick={create}
              disabled={!f.childName.trim() || !f.goal.trim()}
              className="w-full bg-brand text-white rounded-xl p-3 font-display font-semibold disabled:opacity-40 hover:bg-brand/90 transition-colors"
            >
              ✨ צור חוברת
            </button>
          )}
        </>
      ) : (
        <>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm font-medium">
            ✅ החוברת נוצרה ונשמרה בענן!
          </div>
          <Preview html={html} />
          <button
            onClick={reset}
            className="w-full border border-ink/20 rounded-xl p-3 text-sm text-ink/60 hover:text-ink transition-colors"
          >
            + צור חוברת חדשה
          </button>
        </>
      )}
    </section>
  );
}
