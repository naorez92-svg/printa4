import { useState } from "react";
import { supabase } from "../lib/supabase";
import Preview from "./Preview";

const WORLDS = ["כדורגל", "גיימינג", "חיות", "חלל", "בישול", "מוזיקה", "סוסים", "נינג'ה"];
const LEVELS = [
  ["basic", "🌱 בסיסי"],
  ["medium", "⚡ בינוני"],
  ["advanced", "🚀 מתקדם"],
];

export default function Create({ onSaved }) {
  const [f, setF] = useState({
    childName: "",
    grade: "",
    world: "כדורגל",
    goal: "",
    level: "medium",
  });
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const create = async () => {
    setLoading(true);
    setHtml("");
    setError("");

    const { data, error: fnErr } = await supabase.functions.invoke("generate-booklet", {
      body: f,
    });

    if (fnErr || !data?.html) {
      setLoading(false);
      setError("שגיאה ביצירת החוברת. נסה שוב.");
      return;
    }

    setHtml(data.html);

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

    setLoading(false);
    onSaved?.();
  };

  return (
    <section className="space-y-3 bg-white rounded-2xl p-5 shadow-sm border border-ink/5">
      <h2 className="text-xl font-semibold">חוברת חדשה</h2>

      <input
        className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right"
        placeholder="שם הילד/ה *"
        value={f.childName}
        onChange={set("childName")}
      />
      <input
        className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right"
        placeholder="גיל / כיתה (למשל: כיתה ג, 9 שנים)"
        value={f.grade}
        onChange={set("grade")}
      />

      <div>
        <label className="block text-sm text-ink/60 mb-1">עולם תוכן אהוב</label>
        <select
          className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic bg-white text-right"
          value={f.world}
          onChange={set("world")}
        >
          {WORLDS.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
      </div>

      <textarea
        className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none"
        placeholder="יעד פדגוגי * (למשל: חיבור וחיסור עד 100, לוח כפל 6-8, קריאת שעון…)"
        rows={2}
        value={f.goal}
        onChange={set("goal")}
      />

      <div className="flex gap-2">
        {LEVELS.map(([v, t]) => (
          <button
            key={v}
            onClick={() => setF({ ...f, level: v })}
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

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        onClick={create}
        disabled={loading || !f.childName.trim() || !f.goal.trim()}
        className="w-full bg-brand text-white rounded-xl p-3 font-display font-semibold disabled:opacity-50 hover:bg-brand/90 transition-colors"
      >
        {loading ? "Claude מייצר את החוברת… (30-60 שניות)" : "✨ צור חוברת"}
      </button>

      {html && <Preview html={html} />}
    </section>
  );
}
