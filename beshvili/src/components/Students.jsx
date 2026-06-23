import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import QuickCreate from "./QuickCreate";

const GRADES = [
  "גן חובה", "כיתה א", "כיתה ב", "כיתה ג", "כיתה ד",
  "כיתה ה", "כיתה ו", "כיתה ז", "כיתה ח", "כיתה ט",
];
const LEVELS = [["basic", "🌱 בסיסי"], ["medium", "⚡ בינוני"], ["advanced", "🚀 מתקדם"]];
const LEVEL_LABELS = { basic: "🌱 בסיסי", medium: "⚡ בינוני", advanced: "🚀 מתקדם" };
const EMPTY = { name: "", grade: "כיתה א", level: "medium", special_needs: "" };

export default function Students({ onBookletSaved, remaining, isPro }) {
  const [students, setStudents]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [quickCreate, setQuickCreate] = useState(null);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("children")
      .select("*")
      .order("grade")
      .order("name");
    setStudents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  const addStudent = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("children").insert({
      user_id: user.id,
      name: form.name.trim(),
      grade: form.grade,
      level: form.level,
      special_needs: form.special_needs.trim() || null,
    });
    setSaving(false);
    setShowAdd(false);
    setForm(EMPTY);
    fetchStudents();
  };

  const deleteStudent = async (id) => {
    if (!confirm("למחוק את התלמיד/ה?")) return;
    await supabase.from("children").delete().eq("id", id);
    fetchStudents();
  };

  const byGrade = students.reduce((acc, s) => {
    const g = s.grade || "ללא כיתה";
    (acc[g] = acc[g] || []).push(s);
    return acc;
  }, {});

  if (quickCreate) {
    return (
      <QuickCreate
        student={quickCreate}
        onClose={() => setQuickCreate(null)}
        onSaved={() => { setQuickCreate(null); onBookletSaved?.(); }}
        remaining={remaining}
        isPro={isPro}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-ink">👥 התלמידים שלי</h2>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="bg-magic text-white rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            + הוסף תלמיד
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-ink/5 space-y-3">
          <h3 className="font-semibold text-ink">הוסף תלמיד/ה</h3>

          <input
            autoFocus
            className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50"
            placeholder="שם התלמיד/ה *"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />

          <select
            className="w-full border border-ink/20 rounded-xl p-3 bg-canvas/50 text-right outline-none focus:border-magic"
            value={form.grade}
            onChange={e => setForm(p => ({ ...p, grade: e.target.value }))}
          >
            {GRADES.map(g => <option key={g}>{g}</option>)}
          </select>

          <div className="flex gap-2">
            {LEVELS.map(([v, t]) => (
              <button
                key={v}
                onClick={() => setForm(p => ({ ...p, level: v }))}
                className={`flex-1 rounded-xl p-2 text-sm font-medium border transition-colors ${form.level === v ? "bg-magic text-white border-magic shadow-sm" : "bg-canvas/50 border-ink/15 text-ink/60 hover:border-magic/50"}`}
              >
                {t}
              </button>
            ))}
          </div>

          <textarea
            className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none bg-canvas/50 text-sm"
            placeholder="הערות (אופציונלי) — קשיים, חוזקות, הנחיות מיוחדות..."
            rows={2}
            value={form.special_needs}
            onChange={e => setForm(p => ({ ...p, special_needs: e.target.value }))}
          />

          <div className="flex gap-2">
            <button
              onClick={addStudent}
              disabled={saving || !form.name.trim()}
              className="flex-1 bg-magic text-white rounded-xl p-3 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {saving ? "שומר..." : "💾 שמור"}
            </button>
            <button
              onClick={() => { setShowAdd(false); setForm(EMPTY); }}
              className="px-5 border border-ink/15 rounded-xl text-ink/50 hover:text-ink transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-ink/30">טוען...</div>
      )}

      {/* Empty state */}
      {!loading && students.length === 0 && !showAdd && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-ink/5 text-center space-y-4">
          <div className="text-5xl">👩‍🏫</div>
          <div>
            <p className="font-semibold text-ink">עדיין אין תלמידים שמורים</p>
            <p className="text-ink/40 text-sm mt-1">שמרי תלמיד פעם אחת ואז צרי לו חוברת בלחיצה אחת</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-magic text-white rounded-xl px-5 py-2.5 font-medium hover:opacity-90 transition-opacity"
          >
            + הוסף תלמיד ראשון
          </button>
        </div>
      )}

      {/* Student cards grouped by grade */}
      {!loading && Object.entries(byGrade).map(([grade, list]) => (
        <div key={grade} className="space-y-2">
          <p className="text-xs font-semibold text-ink/35 uppercase tracking-wider px-1">{grade} · {list.length} תלמידים</p>
          {list.map(student => (
            <div
              key={student.id}
              className="bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-ink/5 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink">{student.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-ink/40">{LEVEL_LABELS[student.level] || student.level}</span>
                  {student.special_needs && (
                    <span
                      className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 cursor-help"
                      title={student.special_needs}
                    >
                      📌 הערות
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setQuickCreate(student)}
                className="bg-gradient-to-l from-brand to-magic text-white rounded-xl px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap"
              >
                ✨ צור
              </button>

              <button
                onClick={() => deleteStudent(student.id)}
                className="text-ink/20 hover:text-red-400 transition-colors text-xl leading-none flex-shrink-0"
                title="מחק"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
