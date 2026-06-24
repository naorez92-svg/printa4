import { useEffect, useRef, useState, useCallback } from "react";

const A4_PX = 794;
const A4_H  = 620;

function isMobileDevice() {
  return typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function Preview({ html, onReset, shareToken }) {
  const wrapperRef = useRef(null);
  const [scale, setScale]   = useState(1);
  const [copied, setCopied] = useState(false);
  const isMobile = isMobileDevice();

  useEffect(() => {
    const update = () => {
      if (!wrapperRef.current) return;
      setScale(Math.min(1, wrapperRef.current.offsetWidth / A4_PX));
    };
    update();
    const ro = new ResizeObserver(update);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  const scaledHeight = Math.round(A4_H * scale);

  const getPrintHtml = () =>
    html.includes("@page")
      ? html
      : html.replace(
          "</head>",
          "<style>@page{size:A4;margin:0}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}</style></head>"
        );

  // Opens in a new tab — used for both "view full screen" and mobile print flow
  const openInNewTab = () => {
    const w = window.open("", "_blank");
    if (!w) { alert("אפשרי חלונות קופצים בדפדפן"); return; }
    w.document.write(getPrintHtml());
    w.document.close();
  };

  // On desktop: opens new tab + triggers print dialog
  // On mobile: just opens in new tab (print dialog from the browser's share menu)
  const handlePrint = () => {
    if (isMobile) { openInNewTab(); return; }
    const w = window.open("", "_blank");
    if (!w) { alert("אפשרי חלונות קופצים בדפדפן"); return; }
    w.document.write(getPrintHtml());
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 800);
  };

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); handlePrint(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [html]);

  const shareWhatsApp = () => {
    const link = shareToken
      ? `${window.location.origin}/b/${shareToken}`
      : window.location.origin;
    const msg = encodeURIComponent(`יצרתי חוברת לימוד מותאמת אישית עם בשבילי AI 📚\n${link}`);
    window.open("https://wa.me/?text=" + msg, "_blank");
  };

  const copyShareLink = useCallback(async () => {
    if (!shareToken) return;
    const link = `${window.location.origin}/b/${shareToken}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const el = document.createElement("textarea");
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [shareToken]);

  const downloadHtml = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    a.download = "חוברת-בשבילי.html";
    a.click();
  };

  return (
    <div className="space-y-3">
      {/* Scaled iframe */}
      <div
        ref={wrapperRef}
        className="rounded-2xl overflow-hidden border border-ink/10 shadow-lg bg-white relative"
        style={{ height: `${scaledHeight}px` }}
      >
        <iframe
          title="תצוגה מקדימה"
          srcDoc={html}
          sandbox="allow-scripts"
          style={{
            width: `${A4_PX}px`,
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
        {/* Open full screen button */}
        <button
          onClick={openInNewTab}
          className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm border border-ink/15 rounded-lg px-2.5 py-1.5 text-xs text-ink/60 hover:text-ink hover:border-ink/30 transition-colors shadow-sm flex items-center gap-1.5"
        >
          <span>⛶</span>
          <span>מסך מלא</span>
        </button>
        {/* Fade-out hint */}
        <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-white/70 to-transparent pointer-events-none" />
      </div>

      <p className="text-center text-xs text-ink/30">גלול בתוך התצוגה לצפייה בכל העמודים</p>

      {/* WhatsApp — primary share CTA (most mobile-friendly action) */}
      <button
        onClick={shareWhatsApp}
        className="w-full flex items-center justify-center gap-2.5 bg-[#25D366] text-white rounded-2xl p-4 font-display font-semibold text-base hover:opacity-90 transition-opacity shadow-md"
      >
        <span className="text-xl">💬</span>
        <span>שתפי בוואטסאפ</span>
      </button>

      {/* Print / Save PDF */}
      <button
        onClick={handlePrint}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-grow to-grow/80 text-white rounded-2xl p-4 font-display font-semibold text-base hover:opacity-90 transition-opacity shadow-md"
      >
        <span className="text-xl">🖨️</span>
        <span>{isMobile ? "פתחי לצפייה ושמירה כ-PDF" : "הדפס / שמור PDF"}</span>
        {!isMobile && <span className="text-white/50 text-xs font-normal mr-1">Ctrl+P</span>}
      </button>

      {/* Mobile PDF instructions */}
      {isMobile && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 text-right space-y-1">
          <p className="font-semibold">איך שומרים PDF בטלפון?</p>
          <p>iOS Safari: לחצי שתף ← "הדפס" ← פרגני ← שמור PDF</p>
          <p>Android Chrome: לחצי ⋮ ← "הדפס" ← שנה יעד → "שמור כ-PDF"</p>
        </div>
      )}

      {/* Copy share link */}
      {shareToken && (
        <button
          onClick={copyShareLink}
          className={`w-full flex items-center justify-center gap-2 rounded-xl p-3 text-sm font-semibold transition-all ${
            copied
              ? "bg-grow/10 border border-grow/30 text-grow"
              : "border border-ink/15 text-ink/60 hover:border-magic hover:text-magic"
          }`}
        >
          <span>{copied ? "✓" : "🔗"}</span>
          {copied ? "הקישור הועתק!" : "העתק קישור לשיתוף"}
        </button>
      )}

      {/* Secondary actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={downloadHtml}
          className="flex items-center justify-center gap-2 border border-ink/15 rounded-xl p-3 text-sm text-ink/60 hover:text-ink hover:border-ink/30 transition-colors"
        >
          <span>💾</span> הורד HTML
        </button>
        {onReset && (
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 border border-ink/15 rounded-xl p-3 text-sm text-ink/50 hover:text-ink hover:border-ink/30 transition-colors"
          >
            ✨ חוברת חדשה
          </button>
        )}
      </div>

      {!isMobile && (
        <p className="text-center text-xs text-ink/25">
          לחץ "הדפס / שמור PDF" ← בחר <strong className="text-ink/40">שמור כ-PDF</strong> בחלון ההדפסה
        </p>
      )}
    </div>
  );
}
