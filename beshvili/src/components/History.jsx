import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Preview from "./Preview";

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

      {loading && <p className="text-ink/40 text-sm animate-pulse">טוען…</p>}
      {loadError && <p className="text-red-500 text-sm">שגיאה בטעינת החוברות — נסה לרענן את הדף</p>}
      {!loading && items.length === 0 && !loadError && (
        <p className="text-ink/50 text-sm">עדיין אין חוברות. צור את הראשונה למעלה.</p>
      )}
      {!loading && items.length > 0 && filtered.length === 0 && (
        <p className="text-ink/40 text-sm text-center py-4">לא נמצאו תוצאות עבור "{search}"</p>
      )}
      {filtered.map((b) => (
        <BookletRow key={b.id} booklet={b} onDelete={onDelete} />
      ))}
    </section>
  );
}

function BookletRow({ booklet: b, onDelete }) {
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

  const fmtDate = (ts) =>
    new Date(ts).toLocaleDateString("he-IL", {
      day: "numeric", month: "short", year: "numeric",
    });

  return (
    <div className="bg-white rounded-xl border border-ink/5 overflow-hidden shadow-sm">
      <div className="p-4 flex justify-between items-center gap-3">
        <div className="min-w-0">
          <div className="font-display font-semibold truncate">{b.title}</div>
          <div className="text-sm text-ink/50">
            {[b.world, b.child_name, fmtDate(b.created_at)].filter(Boolean).join(" · ")}
          </div>
        </div>
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
          <Preview html={html} shareToken={shareToken} />
        </div>
      )}
    </div>
  );
}
