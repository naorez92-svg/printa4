import { useEffect, useRef, useState } from "react";
import { sanitizeBookletHtml } from "../lib/sanitize";
import { track } from "../hooks/useEvents";
import { IS_INAPP, openExternal } from "../lib/inapp";

const A4_PX = 794;
const A4_H  = 1123; // A4 at 96dpi: 297mm × (96/25.4) ≈ 1123px

function injectHeightProbe(html) {
  const probe = `<script>(function(){function s(){window.parent.postMessage({type:"beshvili_height",height:document.body.scrollHeight},"*")}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",s)}else{s()}window.addEventListener("load",function(){setTimeout(s,300)})})()</script>`;
  return html.includes("</body>") ? html.replace("</body>", probe + "</body>") : html + probe;
}

export default function PublicBooklet({ token }) {
  const [booklet, setBooklet] = useState(null);
  const [error, setError]     = useState(null);
  const [scale, setScale]     = useState(1);
  const [iframeHeight, setIframeHeight] = useState(A4_H);
  const containerRef = useRef(null); // outer div — measures available width
  const iframeRef = useRef(null);

  useEffect(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL || "https://gywpdzkvkdisonuzhsib.supabase.co"}/functions/v1/view-booklet?token=${token}`;
    fetch(url)
      .then(r => r.ok ? r.json() : r.text().then(t => {
        let e = {};
        try { e = JSON.parse(t); } catch {}
        throw new Error(e.error || `שגיאת שרת ${r.status}`);
      }))
      .then(data => setBooklet(data ? { ...data, html: sanitizeBookletHtml(data.html) } : data))
      .catch(e => setError(e.message));
  }, [token]);

  // Fire public_booklet_view once on successful load.
  useEffect(() => {
    if (booklet) track("public_booklet_view", { token, title: booklet.title });
  }, [booklet, token]);

  // Arrived from an in-app browser's "print" escape (?print=1) in a real
  // browser — auto-open the print dialog so printing is one fewer tap.
  useEffect(() => {
    if (!booklet || IS_INAPP) return;
    if (!new URLSearchParams(window.location.search).has("print")) return;
    const t = setTimeout(() => openAndPrint("auto", true), 600);
    return () => clearTimeout(t);
  }, [booklet]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire public_booklet_not_found when the error/not-found path is reached.
  useEffect(() => {
    if (error) track("public_booklet_not_found", { token });
  }, [error, token]);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      setScale(Math.min(1, containerRef.current.offsetWidth / A4_PX));
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Receive actual content height from iframe postMessage probe.
  // srcDoc iframes with allow-scripts (no allow-same-origin) always send origin "null".
  useEffect(() => {
    const handler = (e) => {
      if (e.origin !== "null" && e.origin !== window.location.origin) return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      const h = e.data?.height;
      if (e.data?.type === "beshvili_height" && typeof h === "number" && h > A4_H && h < 60000) {
        setIframeHeight(h);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const openAndPrint = (location, auto = false) => {
    track("public_booklet_print", { token, location, inapp: IS_INAPP });
    if (!booklet?.html) return;
    // window.print() doesn't work in Facebook/Instagram in-app browsers — reopen
    // this same public page in the real browser, where print works. The ?print=1
    // flag makes it auto-open the print dialog on arrival.
    if (IS_INAPP) {
      const sep = window.location.href.includes("?") ? "&" : "?";
      openExternal(`${window.location.href.split("#")[0]}${sep}print=1`);
      return;
    }
    const blob = new Blob([booklet.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    // On the auto path the popup may be blocked (no user gesture) — stay silent,
    // the visible print button still works. Only nag on an explicit click.
    if (!w) { if (!auto) alert("אפשר חלונות קופצים בדפדפן"); URL.revokeObjectURL(url); return; }
    setTimeout(() => {
      try { w.focus(); w.print(); } catch {}
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    }, 1000);
  };

  if (error) return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4" dir="rtl">
      <div className="text-center space-y-3">
        <div className="text-5xl">😕</div>
        <p className="text-ink font-semibold">החוברת לא נמצאה</p>
        <p className="text-ink/40 text-sm">ייתכן שהקישור שגוי או שהחוברת הוסרה</p>
        <a href="https://www.beshvili.com" onClick={() => track("public_booklet_cta_click", { token, location: "error" })} className="text-magic text-sm underline">לבשבילי ←</a>
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

  const scaledW = Math.round(A4_PX * scale);
  const scaledH = Math.round(iframeHeight * scale);

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
            onClick={() => openAndPrint("header")}
            className="bg-gradient-to-l from-grow to-grow/80 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            🖨️ הדפס
          </button>
          <a
            href="https://www.beshvili.com"
            onClick={() => track("public_booklet_cta_click", { token, location: "header" })}
            className="border border-ink/15 text-ink/50 rounded-xl px-3 py-2 text-xs hover:text-ink transition-colors"
          >
            צרי גם ✨
          </a>
        </div>
      </div>

      {/* Booklet preview */}
      <div className="max-w-screen-sm mx-auto p-4 space-y-4">
        {/* containerRef measures the available width; inner div gets exact scaled dimensions */}
        <div ref={containerRef} className="w-full">
          <div
            dir="ltr"
            className="rounded-2xl overflow-hidden border border-ink/10 shadow-lg bg-white relative"
            style={{ width: `${scaledW}px`, height: `${scaledH}px` }}
          >
            <iframe
              ref={iframeRef}
              title={booklet.title || "חוברת"}
              srcDoc={injectHeightProbe(booklet.html)}
              sandbox="allow-scripts"
              style={{
                width:  `${A4_PX}px`,
                height: `${iframeHeight}px`,
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
        </div>


        <button
          onClick={() => openAndPrint("footer")}
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
            href="https://www.beshvili.com"
            onClick={() => track("public_booklet_cta_click", { token, location: "promo_footer" })}
            className="inline-block bg-gradient-to-l from-brand to-magic text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            נסי חינם ← בשבילי
          </a>
        </div>
      </div>
    </div>
  );
}
