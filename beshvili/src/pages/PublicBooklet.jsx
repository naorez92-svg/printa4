import { useEffect, useState } from "react";

const A4_PX = 794;
const A4_H  = 620;

export default function PublicBooklet({ token }) {
  const [booklet, setBooklet] = useState(null);
  const [error, setError]     = useState(null);
  const [scale, setScale]     = useState(1);

  useEffect(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/view-booklet?token=${token}`;
    fetch(url)
      .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error); }))
      .then(setBooklet)
      .catch(e => setError(e.message));
  }, [token]);

  useEffect(() => {
    const update = () => setScale(Math.min(1, window.innerWidth / A4_PX));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const openAndPrint = () => {
    if (!booklet?.html) return;
    const w = window.open("", "_blank");
    if (!w) { alert("אפשר חלונות קופצים בדפדפן"); return; }
    w.document.write(booklet.html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 800);
  };

  if (error) return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4" dir="rtl">
      <div className="text-center space-y-3">
        <div className="text-5xl">😕</div>
        <p className="text-ink font-semibold">החוברת לא נמצאה</p>
        <p className="text-ink/40 text-sm">ייתכן שהקישור שגוי או שהחוברת הוסרה</p>
        <a href="https://printa4-eight.vercel.app" className="text-magic text-sm underline">לבשבילי ←</a>
      </div>
    </div>
  );

  if (!booklet) return (
    <div className="min-h-screen bg-canvas flex items-center justify-center" dir="rtl">
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-magic animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );

  const scaledH = Math.round(A4_H * scale);

  return (
    <div className="min-h-screen bg-canvas" dir="rtl">
      {/* Minimal header */}
      <div className="sticky top-0 z-10 bg-white border-b border-ink/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">📚</span>
          <span className="font-display font-semibold text-ink text-sm truncate max-w-[180px]">
            {booklet.title || "חוברת לימוד"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openAndPrint}
            className="bg-gradient-to-l from-grow to-grow/80 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            🖨️ הדפס
          </button>
          <a
            href="https://printa4-eight.vercel.app"
            className="border border-ink/15 text-ink/50 rounded-xl px-3 py-2 text-xs hover:text-ink transition-colors"
          >
            צרי גם ✨
          </a>
        </div>
      </div>

      {/* Booklet preview */}
      <div className="max-w-screen-sm mx-auto p-4 space-y-4">
        <div
          className="rounded-2xl overflow-hidden border border-ink/10 shadow-lg bg-white relative"
          style={{ height: `${scaledH}px` }}
        >
          <iframe
            title={booklet.title || "חוברת"}
            srcDoc={booklet.html}
            sandbox="allow-scripts"
            style={{
              width:  `${A4_PX}px`,
              height: `${A4_H}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              border: "none",
              display: "block",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />
          <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-white/70 to-transparent pointer-events-none" />
        </div>

        <p className="text-center text-xs text-ink/30">גלול בתוך התצוגה לצפייה בכל העמודים</p>

        <button
          onClick={openAndPrint}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-grow to-grow/80 text-white rounded-2xl p-4 font-display font-semibold text-base hover:opacity-90 transition-opacity shadow-md"
        >
          <span className="text-xl">🖨️</span>
          הדפס / שמור PDF
        </button>

        {/* Promo footer */}
        <div className="bg-white border border-ink/5 rounded-2xl p-4 text-center space-y-2">
          <p className="text-sm font-semibold text-ink">רוצה ליצור חוברות מותאמות אישית?</p>
          <p className="text-xs text-ink/50">בשבילי יוצרת חוברות AI בעברית בתוך דקה — חינם!</p>
          <a
            href="https://printa4-eight.vercel.app"
            className="inline-block bg-gradient-to-l from-brand to-magic text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            נסי חינם ← בשבילי
          </a>
        </div>
      </div>
    </div>
  );
}
