import { useEffect, useRef, useState } from "react";

const A4_PX = 794; // A4 width at 96dpi
const A4_H  = 620; // visible iframe height (roughly one A4 page)

export default function Preview({ html, onReset }) {
  const wrapperRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      if (!wrapperRef.current) return;
      const w = wrapperRef.current.offsetWidth;
      setScale(Math.min(1, w / A4_PX));
    };
    update();
    const ro = new ResizeObserver(update);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  const scaledHeight = Math.round(A4_H * scale);

  const openAndPrint = () => {
    const printHtml = html.includes("@page")
      ? html
      : html.replace(
          "</head>",
          "<style>@page{size:A4;margin:0}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}</style></head>"
        );
    const w = window.open("", "_blank");
    if (!w) { alert("אפשר חלונות קופצים בדפדפן"); return; }
    w.document.write(printHtml);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 800);
  };

  const downloadHtml = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    a.download = "חוברת-בשבילי.html";
    a.click();
  };

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); openAndPrint(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [html]);

  const shareWhatsApp = () => {
    const msg = encodeURIComponent("יצרתי חוברת לימוד מותאמת אישית עם בשבילי AI 📚\nגם את יכולה ← " + window.location.origin);
    window.open("https://wa.me/?text=" + msg, "_blank");
  };

  return (
    <div className="space-y-4">
      {/* Scaled iframe — fills container width perfectly */}
      <div
        ref={wrapperRef}
        className="rounded-2xl overflow-hidden border border-ink/10 shadow-lg bg-white relative"
        style={{ height: `${scaledHeight}px` }}
      >
        <iframe
          title="תצוגה מקדימה"
          srcDoc={html}
          sandbox="allow-same-origin allow-scripts"
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
        <span>הדפס / שמור PDF</span>
        <span className="text-white/50 text-xs font-normal mr-1">Ctrl+P</span>
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={shareWhatsApp}
          className="flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-xl p-3 text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <span>💬</span> שתפי בוואטסאפ
        </button>
        <button
          onClick={downloadHtml}
          className="flex items-center justify-center gap-2 border border-ink/15 rounded-xl p-3 text-sm text-ink/60 hover:text-ink hover:border-ink/30 transition-colors"
        >
          <span>💾</span> הורד HTML
        </button>
      </div>

      {onReset && (
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 border border-ink/15 rounded-xl p-3 text-sm text-ink/50 hover:text-ink hover:border-ink/30 transition-colors"
        >
          ✨ צור חוברת חדשה
        </button>
      )}

      <p className="text-center text-xs text-ink/25">
        לחץ "הדפס / שמור PDF" ← בחר <strong className="text-ink/40">שמור כ-PDF</strong> בחלון ההדפסה
      </p>
    </div>
  );
}
