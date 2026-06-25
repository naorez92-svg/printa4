import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Preview from "./Preview";

const WORLD_COLORS = {
  "כדורגל": "bg-green-100 text-green-700",
  "גיימינג": "bg-violet-100 text-violet-700",
  "חיות":   "bg-orange-100 text-orange-600",
  "חלל":    "bg-blue-100 text-blue-700",
  "בישול":  "bg-red-100 text-red-600",
  "מוזיקה": "bg-pink-100 text-pink-700",
  "סוסים":  "bg-amber-100 text-amber-700",
  "נינג'ה": "bg-gray-200 text-gray-700",
  "פוקימון":"bg-yellow-100 text-yellow-700",
  "מינקראפט":"bg-lime-100 text-lime-700",
  "כללי":   "bg-magic/10 text-magic",
};

const WORLD_ACCENT = {
  "כדורגל": "border-r-4 border-green-400",
  "גיימינג": "border-r-4 border-violet-500",
  "חיות":   "border-r-4 border-orange-400",
  "חלל":    "border-r-4 border-blue-500",
  "בישול":  "border-r-4 border-red-400",
  "מוזיקה": "border-r-4 border-pink-500",
  "סוסים":  "border-r-4 border-amber-500",
  "נינג'ה": "border-r-4 border-gray-500",
  "פוקימון":"border-r-4 border-yellow-400",
  "מינקראפט":"border-r-4 border-lime-500",
  "כללי":   "border-r-4 border-magic",
};

const WORLD_EMOJI = {
  "כדורגל": "⚽", "גיימינג": "🎮", "חיות": "🐾",
  "חלל": "🚀",   "בישול": "🍳",   "מוזיקה": "🎵",
  "סוסים": "🐴", "נינג'ה": "🥷",  "פוקימון": "⚡",
  "מינקראפט": "🧱", "כללי": "📚",
};

function isToday(ts) {
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("booklets")
      .select("id, title, world, child_name, grade, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setLoadError(true);
        setItems(data ?? []);
        setLoading(false);
      });
  }, []);

  const onDelete = (id) => setItems((prev) => prev.filter((b) => b.id !== id));

  const filtered = search.trim()
    ? items.filter(b =>
        b.title?.includes(search) ||
        b.world?.includes(search) ||
        b.child_name?.includes(search)
      )
    : items;

  const totalSavedMin = items.length * 45;
  const totalSavedStr = totalSavedMin >= 120
    ? `${(totalSavedMin / 60).toFixed(1).replace(".0", "")} שעות`
    : `${totalSavedMin} דק'`;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold flex-shrink-0">החוברות שלי</h2>
        {items.length > 3 && (
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="🔍 חיפוש..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-ink/15 rounded-xl p-2 pr-3 text-right bg-white text-sm outline-none focus:border-magic text-ink"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      {/* Total time saved summary */}
      {!loading && items.length > 0 && (
        <div className="bg-gradient-to-l from-grow/10 to-magic/8 border border-grow/20 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-ink">סה"כ חסכת</span>
            <span className="text-xs text-ink/45 mr-1.5">בהכנת חומרי לימוד</span>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-grow font-display">⏱ ~{totalSavedStr}</div>
            <div className="text-[10px] text-ink/35">{items.length} חוברות × ~45 דק' ממוצע</div>
          </div>
        </div>
      )}

      {loading && <p className="text-ink/40 text-sm animate-pulse">טוען…</p>}
      {loadError && <p className="text-red-500 text-sm">שגיאה בטעינת החוברות — נסה לרענן את הדף</p>}
      {!loading && items.length === 0 && !loadError && (
        <p className="text-ink/50 text-sm">עדיין אין חוברות. צור את הראשונה למעלה.</p>
      )}
      {!loading && items.length > 0 && filtered.length === 0 && (
        <p className="text-ink/40 text-sm text-center py-4">לא נמצאו תוצאות עבור "{search}"</p>
      )}
      {filtered.map((b, i) => (
        <BookletRow key={b.id} booklet={b} onDelete={onDelete} index={i} />
      ))}
    </section>
  );
}

function BookletRow({ booklet: b, onDelete, index = 0 }) {
  const [html, setHtml] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState(false);

  const toggle = async () => {
    if (html) { setHtml(null); setShareToken(null); return; }
    if (loadingHtml) return;
    setLoadingHtml(true);
    const { data } = await supabase.from("booklets").select("html, share_token").eq("id", b.id).single();
    setHtml(data?.html ?? null);
    setShareToken(data?.share_token ?? null);
    setLoadingHtml(false);
  };

  const del = async () => {
    if (!confirm(`למחוק את "${b.title}"?`)) return;
    setDeleting(true);
    setDelError(false);
    const { error } = await supabase.from("booklets").delete().eq("id", b.id);
    setDeleting(false);
    if (error) { setDelError(true); return; }
    onDelete(b.id);
  };

  const fmtDate = (ts) => {
    if (isToday(ts)) return "היום";
    return new Date(ts).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
  };

  const world = b.world || "כללי";
  const accentClass = WORLD_ACCENT[world] ?? "border-r-4 border-magic";
  const dotClass    = WORLD_COLORS[world] ?? "bg-magic/10 text-magic";
  const emoji       = WORLD_EMOJI[world]  ?? "📚";
  const today       = isToday(b.created_at);

  return (
    <div
      className={`animate-fade-up bg-white rounded-xl ${accentClass} border border-ink/5 overflow-hidden shadow-sm`}
      style={{ animationDelay: `${Math.min(index * 0.06, 0.4)}s` }}
    >
      <div className="p-4 flex items-center gap-3">
        {/* World emoji circle */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${dotClass}`}>
          {emoji}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold truncate text-ink leading-snug">{b.title}</div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {b.child_name && <span className="text-xs text-ink/50">{b.child_name}</span>}
            <span className="text-xs text-ink/30">{fmtDate(b.created_at)}</span>
            {today && (
              <span className="text-[10px] font-semibold bg-brand/15 text-brand rounded-full px-1.5 py-0.5">היום ✨</span>
            )}
            <span className="text-[10px] text-ink/25 bg-canvas rounded-full px-1.5 py-0.5">⏱ ~45 דק' נחסכו</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={toggle}
            className="text-magic text-sm font-medium hover:underline"
          >
            {loadingHtml ? "…" : html ? "סגור" : "פתח"}
          </button>
          <button
            onClick={del}
            disabled={deleting}
            className={`text-sm ${delError ? "text-red-600 font-medium" : "text-red-400 hover:text-red-600"} disabled:opacity-40`}
            title={delError ? "מחיקה נכשלה — לחץ לנסות שוב" : "מחק"}
          >
            {deleting ? "…" : delError ? "✕ שגיאה" : "✕"}
          </button>
        </div>
      </div>
      {html && (
        <div className="border-t border-ink/5 p-4">
          <Preview html={html} shareToken={shareToken} title={b.title} />
        </div>
      )}
    </div>
  );
}
