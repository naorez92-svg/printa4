import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Preview from "./Preview";
import QuickCreate from "./QuickCreate";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

export default function StudentHistory({ student, onBack, remaining, isPro }) {
  const [booklets, setBooklets] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [viewing, setViewing]   = useState(null);
  const [creating, setCreating] = useState(null);

  const fetchBooklets = () =>
    supabase
      .from("booklets")
      .select("id, title, goal, world, level, created_at, html")
      .eq("child_id", student.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setBooklets(data || []); setLoading(false); });

  useEffect(() => { fetchBooklets(); }, [student.id]);

  if (viewing) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setViewing(null)}
          className="flex items-center gap-1.5 text-sm text-ink/50 hover:text-ink transition-colors"
        >
          ← חזרה ל{student.name}
        </button>
        <Preview html={viewing.html} onReset={() => setViewing(null)} />
      </div>
    );
  }

  if (creating !== null) {
    return (
      <QuickCreate
        student={student}
        initialSubject={creating.subject}
        initialWorld={creating.world}
        onClose={() => setCreating(null)}
        onSaved={() => { setCreating(null); fetchBooklets(); }}
        remaining={remaining}
        isPro={isPro}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-ink/50 hover:text-ink transition-colors flex-shrink-0"
        >
          ← חזרה
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-ink">{student.name}</h2>
          <p className="text-xs text-ink/40">{student.grade} · {booklets.length} חוברות</p>
        </div>
        <button
          onClick={() => setCreating({ subject: "", world: "כדורגל" })}
          className="bg-gradient-to-l from-brand to-magic text-white rounded-xl px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap"
        >
          ✨ חדשה
        </button>
      </div>

      {loading && <div className="text-center py-12 text-ink/30">טוען...</div>}

      {!loading && booklets.length === 0 && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-ink/5 text-center space-y-4">
          <div className="text-5xl">💭</div>
          <div>
            <p className="font-semibold text-ink">עדיין אין חוברות עבור {student.name}</p>
            <p className="text-ink/40 text-sm mt-1">צרי את החוברת הראשונה עכשוו</p>
          </div>
          <button
            onClick={() => setCreating({ subject: "", world: "כדורגל" })}
            className="bg-magic text-white rounded-xl px-5 py-2.5 font-medium hover:opacity-90"
          >
            ✨ צור חוברת ראשונה
          </button>
        </div>
      )}

      {!loading && booklets.map((b) => {
        const subject = b.goal?.split(" — ")[0] ?? b.goal ?? "";
        const detail  = b.goal?.split(" — ")[1] ?? "";
        return (
          <div key={b.id} className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-ink/5 space-y-3">
            <div>
              <p className="font-semibold text-ink text-sm leading-snug">{subject}</p>
              {detail && <p className="text-xs text-ink/50 mt-0.5">{detail}</p>}
              <p className="text-xs text-ink/30 mt-1">{fmtDate(b.created_at)}{b.world ? ` · ${b.world}` : ""}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewing(b)}
                className="flex-1 flex items-center justify-center gap-1.5 border border-ink/15 rounded-xl py-2 text-sm text-ink/60 hover:text-ink hover:border-ink/30 transition-colors"
              >
                👁️ צפה
              </button>
              <button
                onClick={() => setCreating({ subject, world: b.world || "כדורגל" })}
                className="flex-1 flex items-center justify-center gap-1.5 border border-magic/30 bg-magic/5 rounded-xl py-2 text-sm text-magic hover:bg-magic/10 transition-colors"
              >
                🔄 צור שוב
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
