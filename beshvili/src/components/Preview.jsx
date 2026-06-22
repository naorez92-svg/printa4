import { useEffect } from "react";

export default function Preview({ html, onReset }) {
  // Auto-trigger print dialog on new window open
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
    // Small delay so fonts / images load before the dialog
    setTimeout(() => { w.focus(); w.print(); }, 800);
  };

  const downloadHtml = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    a.download = "חוברת.html";
    a.click();
  };

  // ⌨️ Ctrl+P → print
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        openAndPrint();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [html]);

  return (
    <div className="space-y-3">
      {/* Preview iframe */}
      <div className="rounded-xl overflow-hidden border border-ink/10 bg-white shadow-sm">
        <iframe
          title="preview"
          srcDoc={html}
          className="w-full h-[580px]"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={openAndPrint}
          className="col-span-2 flex items-center justify-center gap-2 bg-gradient-to-l from-grow to-grow/80 text-white rounded-xl p-3.5 font-display font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="text-lg">🖨️</span>
          <span>הדפס / שמור PDF</span>
          <span className="text-white/60 text-xs font-normal">Ctrl+P</span>
        </button>

        <button
          onClick={downloadHtml}
          className="flex items-center justify-center gap-2 border border-ink/20 rounded-xl p-3 text-sm text-ink/70 hover:text-ink hover:border-ink/40 transition-colors"
        >
          <span>💾</span> הורד HTML
        </button>

        {onReset && (
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 border border-ink/20 rounded-xl p-3 text-sm text-ink/70 hover:text-ink hover:border-ink/40 transition-colors"
          >
            <span>✨</span> חוברת חדשה
          </button>
        )}
      </div>

      <p className="text-center text-xs text-ink/30">
        לחץ "הדפס / שמור PDF" ← בחר <strong>שמור כ-PDF</strong> בחלון ההדפסה של Chrome
      </p>
    </div>
  );
}
