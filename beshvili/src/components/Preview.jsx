import { useEffect, useRef, useState, useCallback } from "react";
import { track } from "../hooks/useEvents";

const A4_PX = 794;
const A4_H  = 1123; // A4 at 96dpi: 297mm × (96/25.4) ≈ 1123px

function injectHeightProbe(html) {
  const probe = `<script>(function(){function s(){window.parent.postMessage({type:"beshvili_height",height:document.body.scrollHeight},"*")}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",s)}else{s()}window.addEventListener("load",function(){setTimeout(s,300)})})()</script>`;
  return html.includes("</body>") ? html.replace("</body>", probe + "</body>") : html + probe;
}

function isMobileDevice() {
  return typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function extractText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, .no-print").forEach(el => el.remove());
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

export default function Preview({ html, onReset, shareToken, title, active = true, context = "unknown" }) {
  const containerRef = useRef(null); // outer div — measures available width
  const iframeRef = useRef(null);
  const [scale, setScale]   = useState(1);
  const [iframeHeight, setIframeHeight] = useState(A4_H);
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState(false);
  const isMobile = isMobileDevice();

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

  // Cancel speech when component unmounts
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const scaledW = Math.round(A4_PX * scale);
  const scaledHeight = Math.round(iframeHeight * scale);

  const getPrintHtml = () =>
    html.includes("@page")
      ? html
      : html.replace(
          "</head>",
          "<style>@page{size:A4;margin:0}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}</style></head>"
        );

  const openInNewTab = () => {
    track("booklet_opened_newtab", { context });
    const printHtml = getPrintHtml();
    const blob = new Blob([printHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) { track("popup_blocked", { action: "newtab" }); alert("אפשרי חלונות קופצים בדפדפן"); URL.revokeObjectURL(url); return; }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  };

  const handlePrint = useCallback(() => {
    track("booklet_printed", { context, isMobile });
    const printHtml = getPrintHtml();
    const blob = new Blob([printHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) { track("popup_blocked", { action: "print" }); alert("אפשרי חלונות קופצים בדפדפן"); URL.revokeObjectURL(url); return; }
    setTimeout(() => {
      try { w.focus(); w.print(); } catch {}
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    }, 1000);
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) return;
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); handlePrint(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [html, active, handlePrint]);

  const utterRef = useRef(null);

  const toggleRead = useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (synth.speaking) {
      // Detach onend so the manual-stop event isn't also counted as a natural end.
      if (utterRef.current) utterRef.current.onend = null;
      synth.cancel();
      setReading(false);
      track("read_aloud_stopped", { context });
      return;
    }

    const text = extractText(html);
    if (!text) return;

    track("read_aloud_started", { context });

    const utter = new SpeechSynthesisUtterance(text);
    utterRef.current = utter;
    utter.lang = "he-IL";
    utter.rate = 0.88;
    utter.pitch = 1.05;

    // Pick a Hebrew voice if available
    const voices = synth.getVoices();
    const heVoice = voices.find(v => v.lang.startsWith("he"));
    if (heVoice) utter.voice = heVoice;

    utter.onstart  = () => setReading(true);
    utter.onend    = () => { setReading(false); track("read_aloud_stopped", { context }); };
    utter.onerror  = () => setReading(false);
    utter.onpause  = () => setReading(false);

    synth.speak(utter);
  }, [html]);

  const shareWhatsApp = () => {
    track("booklet_shared_whatsapp", { context, has_share_token: !!shareToken });
    const link = shareToken
      ? `${window.location.origin}/b/${shareToken}`
      : window.location.origin;
    const bookletPart = title ? `"${title}" ` : "";
    const msg = encodeURIComponent(`יצרתי חוברת לימוד ${bookletPart}עם בשבילי AI 📚\n${link}`);
    window.open("https://wa.me/?text=" + msg, "_blank");
  };

  const copyShareLink = useCallback(async () => {
    if (!shareToken) return;
    track("share_link_copied", { context });
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
    track("booklet_html_downloaded", { context });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "חוברת-בשבילי.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <div className="space-y-3">
      {/* Scaled iframe — containerRef measures available width; inner div gets exact scaled dims */}
      <div ref={containerRef} className="w-full">
      <div
        dir="ltr"
        className="rounded-2xl overflow-hidden border border-ink/10 shadow-lg bg-white relative"
        style={{ width: `${scaledW}px`, height: `${scaledHeight}px` }}
      >
        <iframe
          ref={iframeRef}
          title="תצוגה מקדימית"
          srcDoc={injectHeightProbe(html)}
          sandbox="allow-scripts"
          style={{
            width: `${A4_PX}px`,
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
      </div>


      {/* WhatsApp — primary share CTA */}
      <button
        onClick={shareWhatsApp}
        className="w-full flex items-center justify-center gap-2.5 bg-[#25D366] text-white rounded-2xl p-4 font-display font-semibold text-base hover:opacity-90 transition-opacity shadow-md"
      >
        <span className="text-xl">💬</span>
        <span>שתפי בוואטסאפ</span>
      </button>

      {/* Mobile PDF instructions — shown BEFORE the button so user knows what to expect */}
      {isMobile && (
        <div className="bg-canvas border border-ink/10 rounded-xl px-4 py-3 text-xs text-ink/50 text-right space-y-1">
          <p className="font-semibold text-ink/70">📥 איך שומרים PDF בטלפון?</p>
          <p>לאחר לחיצה תיפתח החוברת בדף חדש עם כפתור הדפסה.</p>
          <p><span className="font-medium text-ink/60">iPhone:</span> שתף ← "הדפס" ← פרגני ← שמור PDF</p>
          <p><span className="font-medium text-ink/60">Android:</span> ⋮ ← "הדפס" ← שנה יעד ← "שמור כ-PDF"</p>
        </div>
      )}

      {/* Print / Save PDF */}
      <button
        onClick={handlePrint}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-grow to-grow/80 text-white rounded-2xl p-4 font-display font-semibold text-base hover:opacity-90 transition-opacity shadow-md"
      >
        <span className="text-xl">🖨️</span>
        <span>{isMobile ? "פתחי לשמירה כ-PDF" : "הדפס / שמור PDF"}</span>
        {!isMobile && <span className="text-white/50 text-xs font-normal mr-1">Ctrl+P</span>}
      </button>

      {/* Read aloud */}
      <button
        onClick={toggleRead}
        className={`w-full flex items-center justify-center gap-2.5 rounded-2xl p-4 font-display font-semibold text-base transition-all shadow-sm ${
          reading
            ? "bg-magic text-white hover:opacity-90"
            : "bg-magic/8 border border-magic/25 text-magic hover:bg-magic/15"
        }`}
      >
        <span className="text-xl">{reading ? "⏹" : "🔊"}</span>
        <span>{reading ? "עצור הקראה" : "הקרא את החוברת"}</span>
        {reading && (
          <span className="flex gap-0.5 mr-1">
            {[0,1,2].map(i => (
              <span key={i} className="w-1 h-4 bg-white/70 rounded-full animate-bounce inline-block" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        )}
      </button>

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
            onClick={() => { track("booklet_reset", { context }); onReset(); }}
            className="flex items-center justify-center gap-2 border border-ink/15 rounded-xl p-3 text-sm text-ink/50 hover:text-ink hover:border-ink/30 transition-colors"
          >
            ✨ חוברת חדשה
          </button>
        )}
      </div>

      {!isMobile && (
        <p className="text-center text-xs text-ink/25">
          לחץ "הדפס / שמור PDF" ← בחר <strong className="text-ink/40">שמור כ־ PDF</strong> בחלון ההדפסה
        </p>
      )}
    </div>
  );
}
