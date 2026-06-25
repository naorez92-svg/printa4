import { useEffect, useRef, useState, useCallback } from "react";

const A4_PX = 794;
const A4_H  = 1123; // A4 at 96dpi: 297mm × (96/25.4) ≈ 1123px

function isMobileDevice() {
  return typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function extractText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, .no-print").forEach(el => el.remove());
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

export default function Preview({ html, onReset, shareToken, active = true }) {
  const wrapperRef = useRef(null);
  const [scale, setScale]   = useState(1);
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState(false);
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

  // Cancel speech when component unmounts
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const scaledHeight = Math.round(A4_H * scale);

  const getPrintHtml = () =>
    html.includes("@page")
      ? html
      : html.replace(
          "</head>",
          "<style>@page{size:A4;margin:0}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}</style></head>"
        );

  const openInNewTab = () => {
    const w = window.open("", "_blank");
    if (!w) { alert("אפשרי חלונות קופצים בדפדפן"); return; }
    w.document.write(getPrintHtml());
    w.document.close();
  };

  const handlePrint = () => {
    if (isMobile) { openInNewTab(); return; }
    const w = window.open("", "_blank");
    if (!w) { alert("אפשרי חלונות קופצים בדפדפן"); return; }
    w.document.write(getPrintHtml());
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 800);
  };

  useEffect(() => {
    if (!active) return;
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); handlePrint(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [html, active]);

  const toggleRead = useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (synth.speaking) {
      synth.cancel();
      setReading(false);
      return;
    }

    const text = extractText(html);
    if (!text) return;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "he-IL";
    utter.rate = 0.88;
    utter.pitch = 1.05;

    // Pick a Hebrew voice if available
    const voices = synth.getVoices();
    const heVoice = voices.find(v => v.lang.startsWith("he"));
    if (heVoice) utter.voice = heVoice;

    utter.onstart  = () => setReading(true);
    utter.onend    = () => setReading(false);
    utter.onerror  = () => setReading(false);
    utter.onpause  = () => setReading(false);

    synth.speak(utter);
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

      {/* WhatsApp — primary share CTA */}
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
