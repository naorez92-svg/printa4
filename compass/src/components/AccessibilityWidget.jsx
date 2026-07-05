import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

// Self-hosted accessibility widget (no external dependency) — Israeli IS 5568 /
// WCAG-style adjustments. Adjustments are applied to #root (so the widget itself,
// portaled to <body>, stays unaffected by contrast) and persisted in localStorage.
const KEY = "beshvili_a11y";
const DEFAULTS = { font: 0, contrast: false, links: false, readable: false, motion: false };

const STYLE_ID = "a11y-styles";
const CSS = `
#root.a11y-contrast { filter: contrast(1.35) saturate(1.1); }
#root.a11y-links a { text-decoration: underline !important; outline: 1px dashed currentColor; outline-offset: 2px; }
#root.a11y-readable, #root.a11y-readable * { font-family: Arial, "Segoe UI", sans-serif !important; letter-spacing: .01em; }
`;

function apply(s) {
  try {
    const root = document.getElementById("root");
    if (root) {
      root.classList.toggle("a11y-contrast", s.contrast);
      root.classList.toggle("a11y-links", s.links);
      root.classList.toggle("a11y-readable", s.readable);
      root.classList.toggle("a11y-reduce-motion", s.motion);
    }
    // Font scaling via the document root so rem-based sizing scales everywhere.
    document.documentElement.style.fontSize = s.font ? `${100 + s.font * 12.5}%` : "";
  } catch { /* SSR / no DOM */ }
}

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULTS; }
  });
  const panelRef = useRef(null);

  // Inject the scoped stylesheet once.
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID; el.textContent = CSS;
    document.head.appendChild(el);
  }, []);

  // Apply + persist whenever settings change.
  useEffect(() => {
    apply(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, [s]);

  // Close on Esc.
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const reset = () => setS(DEFAULTS);

  const Toggle = ({ label, active, onClick }) => (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
        active ? "bg-magic text-white border-magic" : "bg-white text-ink border-ink/15 hover:border-magic/50"
      }`}
    >
      <span>{label}</span>
      <span className="text-xs">{active ? "פעיל ✓" : "כבוי"}</span>
    </button>
  );

  return createPortal(
    <div dir="rtl">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="אפשרויות נגישות"
        aria-expanded={open}
        className="fixed bottom-20 right-4 lg:bottom-6 z-[60] w-12 h-12 rounded-full bg-ink text-white shadow-lg flex items-center justify-center text-2xl hover:scale-105 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-magic"
        style={{ fontSize: "1.5rem" }}
      >
        ♿
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="תפריט נגישות"
          className="fixed bottom-36 right-4 lg:bottom-24 z-[60] w-72 max-w-[calc(100vw-2rem)] bg-canvas rounded-2xl shadow-2xl border border-ink/10 p-4 space-y-2"
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-ink text-sm">♿ נגישות</h2>
            <button onClick={() => setOpen(false)} aria-label="סגור" className="text-ink/40 hover:text-ink text-lg leading-none">×</button>
          </div>

          {/* Font size */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => set({ font: Math.max(0, s.font - 1) })}
              disabled={s.font <= 0}
              aria-label="הקטן טקסט"
              className="flex-1 py-2 rounded-xl border border-ink/15 bg-white text-ink font-bold disabled:opacity-40 hover:border-magic/50"
            >א−</button>
            <span className="text-xs text-ink/50 w-14 text-center">טקסט {s.font ? `+${s.font}` : ""}</span>
            <button
              onClick={() => set({ font: Math.min(4, s.font + 1) })}
              disabled={s.font >= 4}
              aria-label="הגדל טקסט"
              className="flex-1 py-2 rounded-xl border border-ink/15 bg-white text-ink font-bold disabled:opacity-40 hover:border-magic/50"
            >א+</button>
          </div>

          <Toggle label="ניגודיות גבוהה" active={s.contrast} onClick={() => set({ contrast: !s.contrast })} />
          <Toggle label="הדגשת קישורים" active={s.links} onClick={() => set({ links: !s.links })} />
          <Toggle label="פונט קריא" active={s.readable} onClick={() => set({ readable: !s.readable })} />
          <Toggle label="הפחתת אנימציות" active={s.motion} onClick={() => set({ motion: !s.motion })} />

          <button onClick={reset} className="w-full py-2 rounded-xl text-sm text-ink/50 hover:text-ink border border-transparent hover:border-ink/10">
            איפוס הגדרות
          </button>
          <a
            href="/accessibility.html"
            className="block text-center text-xs text-magic underline pt-1"
          >
            הצהרת הנגישות המלאה ←
          </a>
        </div>
      )}
    </div>,
    document.body,
  );
}
