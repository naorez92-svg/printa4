import { useEffect } from "react";
import { track } from "../hooks/useEvents";

// First-run welcome shown once to brand-new users (0 booklets). The whole goal is
// to get them to their first booklet in one tap: picking a starter pre-fills the
// create form so the "צור" button is immediately enabled — removing the blank-form
// friction that was leaving signups without ever trying.
const STARTERS = [
  { icon: "📖", label: "הבנת הנקרא — כיתה ג",  grade: "כיתה ג", world: "כדורגל",  goal: "הבנת הנקרא: טקסט קצר, שאלות הבנה ואוצר מילים", level: "basic",  mode: "quick" },
  { icon: "➕", label: "חשבון — כיתה ב",        grade: "כיתה ב", world: "חלל",     goal: "חיבור וחיסור עד 100",                          level: "medium", mode: "quick" },
  { icon: "✖️", label: "לוח הכפל — כיתה ג",     grade: "כיתה ג", world: "גיימינג",  goal: "לוח הכפל: 6, 7, 8 — תרגול ויישום",             level: "medium", mode: "quick" },
];

export default function OnboardingModal({ onPick, onSkip }) {
  useEffect(() => { track("onboarding_modal_shown", {}); }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      dir="rtl"
      onClick={onSkip}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-[fadeIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">🎁</div>
          <h2 className="text-xl font-bold text-ink font-display">ברוכה הבאה לבשבילי!</h2>
          <p className="text-sm text-ink/60 mt-1.5 leading-relaxed">
            החוברת הראשונה שלך מוכנה ב-<strong className="text-magic">60 שניות</strong>.
            בחרי נושא להתחלה — אפשר לשנות הכל אחר כך:
          </p>
        </div>

        <div className="space-y-2">
          {STARTERS.map((s) => (
            <button
              key={s.label}
              onClick={() => onPick(s)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl border border-ink/10 bg-canvas/40 hover:border-magic hover:bg-magic/5 transition-colors text-right"
            >
              <span className="text-2xl flex-shrink-0">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm">{s.label}</p>
                <p className="text-xs text-ink/50 truncate">{s.goal}</p>
              </div>
              <span className="text-magic text-lg flex-shrink-0">←</span>
            </button>
          ))}
        </div>

        <button
          onClick={onSkip}
          className="w-full text-center text-xs text-ink/40 mt-4 py-2 hover:text-ink/60 transition-colors"
        >
          אתחיל לבד →
        </button>
      </div>
    </div>
  );
}
