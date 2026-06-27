import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { track } from "../hooks/useEvents";

const OPTIONS = [
  { key: "too_hard",   emoji: "😓", label: "קשה מדי"  },
  { key: "just_right", emoji: "😊", label: "בדיוק"     },
  { key: "too_easy",   emoji: "🌟", label: "קל מדי"   },
];

export default function BookletRating({ bookletId, studentName, onDone }) {
  const [selected, setSelected] = useState(null);
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState(null);
  const savingRef = useRef(false);

  useEffect(() => {
    track("booklet_rating_shown", { booklet_id: bookletId });
  }, [bookletId]);

  const save = async () => {
    if (!selected || !bookletId) { track("booklet_rating_dismissed", { booklet_id: bookletId }); onDone(); return; }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from("booklets").update({
      difficulty_feedback: selected,
      session_notes: notes.trim() || null,
    }).eq("id", bookletId);
    savingRef.current = false;
    setSaving(false);
    if (error) { setSaveError("השמירה נכשלה — נסה שנית"); return; }
    track("booklet_rating_submitted", { booklet_id: bookletId, difficulty: selected, has_notes: !!notes.trim() });
    onDone();
  };

  return (
    <div className="bg-white rounded-2xl border border-ink/10 shadow-sm p-5 space-y-4">
      <div>
        <h3 className="font-bold text-ink text-base">איך הלכה החוברת? 📊</h3>
        {studentName && <p className="text-xs text-ink/40 mt-0.5">עבור {studentName} · הנתון הזה יעזור לבנות חוברות טובות יותר</p>}
      </div>

      <div className="flex gap-3">
        {OPTIONS.map(({ key, emoji, label }) => (
          <button
            key={key}
            onClick={() => setSelected(selected === key ? null : key)}
            className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${
              selected === key
                ? "border-magic bg-magic/10 scale-105 shadow-sm"
                : "border-ink/10 hover:border-ink/30"
            }`}
          >
            <span className="text-2xl">{emoji}</span>
            <span className="text-xs font-medium text-ink/70">{label}</span>
          </button>
        ))}
      </div>

      {selected && (
        <textarea
          className="w-full border border-ink/20 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm resize-none"
          placeholder="הערה קצרה (אופציונלי) — מה הלך טוב? מה היה קשה?"
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      )}

      {saveError && <p className="text-red-500 text-xs text-center">{saveError}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!selected || saving}
          className="flex-1 bg-gradient-to-l from-brand to-magic text-white rounded-xl p-2.5 font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {saving ? "שומר..." : "שמור ✓"}
        </button>
        <button
          onClick={() => { track("booklet_rating_dismissed", { booklet_id: bookletId }); onDone(); }}
          className="px-4 py-2.5 text-sm text-ink/40 hover:text-ink/60 border border-ink/10 rounded-xl transition-colors"
        >
          דלג
        </button>
      </div>
    </div>
  );
}
