import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Preview from "./Preview";

export default function History() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    supabase
      .from("booklets")
      .select("id, title, world, child_name, grade, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data ?? []));
  }, []);

  const loadHtml = async (id) => {
    if (open === id) { setOpen(null); return; }
    const { data } = await supabase.from("booklets").select("html").eq("id", id).single();
    if (data) setOpen(id);
    return data?.html;
  };

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">החוברות שלי</h2>
      {items.length === 0 && (
        <p className="text-ink/50 text-sm">עדיין אין חוברות. צור את הראשונה למעלה.</p>
      )}
      {items.map((b) => (
        <BookletRow key={b.id} booklet={b} />
      ))}
    </section>
  );
}

function BookletRow({ booklet: b }) {
  const [html, setHtml] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (html) { setHtml(null); return; }
    setLoading(true);
    const { data } = await supabase.from("booklets").select("html").eq("id", b.id).single();
    setHtml(data?.html ?? null);
    setLoading(false);
  };

  const fmtDate = (ts) =>
    new Date(ts).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="bg-white rounded-xl border border-ink/5 overflow-hidden">
      <div className="p-4 flex justify-between items-center">
        <div>
          <div className="font-display font-semibold">{b.title}</div>
          <div className="text-sm text-ink/50">
            {b.world} · {fmtDate(b.created_at)}
          </div>
        </div>
        <button
          onClick={toggle}
          className="text-magic text-sm font-medium hover:underline"
        >
          {loading ? "…" : html ? "סגור" : "פתח"}
        </button>
      </div>
      {html && (
        <div className="border-t border-ink/5 p-4">
          <Preview html={html} />
        </div>
      )}
    </div>
  );
}
