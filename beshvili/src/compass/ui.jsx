// מצפן — shared UI atoms. Dark "night sky" theme built from the beshvili
// design tokens (ink/canvas/brand/magic/grow), RTL Hebrew.

import { STAGES } from "./data/questions";
import { journeyProgress } from "./useJourney";

export const CompassMark = ({ size = 40, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <circle cx="50" cy="50" r="46" fill="none" stroke="#6C5CE7" strokeWidth="6" />
    <circle cx="50" cy="50" r="34" fill="none" stroke="#6C5CE7" strokeWidth="2" opacity="0.35" />
    <path d="M50 14 L58 50 L50 86 L42 50 Z" fill="#F4A02C" />
    <path d="M14 50 L50 42 L86 50 L50 58 Z" fill="#F7F6FB" opacity="0.9" />
    <circle cx="50" cy="50" r="6" fill="#20184A" stroke="#F4A02C" strokeWidth="3" />
  </svg>
);

// Full-screen dark shell with soft glows — every journey screen sits inside it.
export function Shell({ children, wide = false }) {
  return (
    <div className="min-h-screen bg-ink text-white relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 bg-gradient-to-b from-magic/15 via-transparent to-brand/10 pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[480px] h-[480px] bg-magic/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
      <div className={`relative mx-auto px-5 py-6 min-h-screen flex flex-col ${wide ? "max-w-3xl" : "max-w-xl"}`}>
        {children}
      </div>
    </div>
  );
}

export function ProgressHeader({ stageId, onRestart }) {
  const pct = Math.round(journeyProgress(stageId) * 100);
  const stage = STAGES.find((s) => s.id === stageId);
  return (
    <header className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CompassMark size={26} />
          <span className="font-bold font-display text-white/90">מצפן</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/45">{stage?.icon} {stage?.label}</span>
          {onRestart && (
            <button onClick={onRestart} className="text-xs text-white/30 hover:text-white/60 transition-colors">
              התחלה מחדש
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-l from-brand to-magic rounded-full transition-all duration-700"
          style={{ width: `${Math.max(pct, 3)}%` }}
        />
      </div>
    </header>
  );
}

export function Btn({ children, onClick, disabled, ghost, className = "", type = "button" }) {
  const base = ghost
    ? "border border-white/20 text-white/70 hover:border-white/40 hover:text-white"
    : "bg-gradient-to-l from-brand to-magic text-white shadow-lg shadow-magic/25 hover:opacity-90 active:scale-[0.98]";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-6 py-3.5 font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none ${base} ${className}`}
    >
      {children}
    </button>
  );
}

// 1–5 likert row. Big tap targets, labels on the edges.
export function Scale({ value, onSelect, labels }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2" dir="ltr">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => onSelect(v)}
            aria-label={labels[v - 1]}
            className={`h-14 sm:h-16 rounded-2xl border text-lg font-bold transition-all ${
              value === v
                ? "bg-gradient-to-b from-magic to-magic/80 border-magic text-white scale-105 shadow-lg shadow-magic/30"
                : "bg-white/5 border-white/15 text-white/60 hover:border-magic/50 hover:bg-magic/10"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-white/40">
        <span>{labels[4]}</span>
        <span>{labels[0]}</span>
      </div>
    </div>
  );
}

// Selectable chip (single or multi select flows).
export function Chip({ selected, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-medium border transition-all ${
        selected
          ? "bg-magic/25 border-magic text-white"
          : "bg-white/5 border-white/15 text-white/65 hover:border-white/35"
      }`}
    >
      {children}
    </button>
  );
}

// A stage intro screen: icon, title, blurb, start button.
export function StageIntro({ icon, title, text, minutes, onStart }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center animate-[fadeIn_0.5s_ease]">
      <div className="text-6xl mb-5">{icon}</div>
      <h2 className="text-3xl font-bold font-display mb-3">{title}</h2>
      <p className="text-white/60 leading-relaxed max-w-md mb-2">{text}</p>
      {minutes && <p className="text-xs text-white/35 mb-8">~{minutes} דקות</p>}
      <Btn onClick={onStart} className="min-w-[200px]">מתחילים ←</Btn>
    </div>
  );
}

// Tiny markdown-lite renderer for AI report text: **bold**, "- " bullets,
// plain paragraphs. No external deps, no HTML injection (text nodes only).
export function Rich({ text }) {
  if (!text) return null;
  const bold = (line, key) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    return parts.map((p, i) => (i % 2 ? <strong key={`${key}-${i}`} className="text-white font-semibold">{p}</strong> : p));
  };
  const blocks = [];
  let list = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="space-y-1.5 mb-3 pr-1">
          {list.map((l, i) => (
            <li key={i} className="flex gap-2 text-white/75 leading-relaxed">
              <span className="text-brand flex-shrink-0 mt-0.5">◆</span>
              <span>{bold(l, `li-${blocks.length}-${i}`)}</span>
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { flush(); return; }
    if (/^[-•*]\s+/.test(line)) { list.push(line.replace(/^[-•*]\s+/, "")); return; }
    flush();
    blocks.push(
      <p key={`p-${i}`} className="text-white/75 leading-relaxed mb-3">{bold(line, `p-${i}`)}</p>,
    );
  });
  flush();
  return <div>{blocks}</div>;
}
