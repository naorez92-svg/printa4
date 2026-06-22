import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Preview from "./Preview";

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("booklets")
      .select("id, title, world, child_name, grade, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError("לא הצלחתי לטעון את החוברות");
        else setItems(data ?? []);
        setLoading(false);
      });
  }, []);

  const onDelete = (id) => setItems((prev) => prev.filter((b) => b.id !== id));

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">החוברות שלי</h2>
      {loading && <p className="text-ink/40 text-sm animate-pulse">טוען…</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-ink/50 text-sm">עדיין אין חוברות. צור את הראשונה למעלה.</p>
      )}
      {items.map((b) => (
        <BookletRow key={b.id} booklet={b} onDelete={onDelete} />
      ))}
    </section>
  );
}

function BookletRow({ booklet: b, onDelete }) {
  const [html, setHtml] = useState(null);
  const [loadingHtml, setLoadingHtml] = useState(false);

  const toggle = async () => {
    if (html) { setHtml(null); return; }
    setLoadingHtml(true);
    const { data, error } = await supabase.from("booklets").select("html").eq("id", b.id).single();
    setLoadingHtml(false);
    if (error || !data?.html) { alert("לא הצלחתי לטעון את החוברת"); return; }
    setHtml(data.html);
  };

  const del = async () => {
    if (!confirm(`למחוק את "${b.title}"?`)) return;
    const { error } = await supabase.from("booklets").delete().eq("id", b.id);
    if (error) { alert("מחיקה נכשלה — נסה שנית"); return; }
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
            {b.world} · {fmtDate(b.created_at)}
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
            className="text-red-400 text-sm hover:text-red-600"
            title="מחק"
          >
            ✕
          </button>
        </div>
      </div>
      {html && (
        <div className="border-t border-ink/5 p-4">
          <Preview html={html} />
        </div>
      )}
    </div>
  );
}
