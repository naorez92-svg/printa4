import { useState } from "react";
import { supabase } from "../lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const QUESTIONS = {
  use_case: {
    text: "שאלה אחת — לאיזה מצב הכי משתמשת בחוברות?",
    sub: "התשובה שלך עוזרת לנו לבנות את הדבר הבא בשבילך",
    options: [
      { value: "private_lessons", label: "שיעורים פרטיים" },
      { value: "full_class",      label: "כיתה שלמה" },
      { value: "homework",        label: "שיעורי בית" },
    ],
    trigger: "second_booklet",
  },
};

export default function SurveyModal({ questionKey = "use_case", onClose }) {
  const [answered, setAnswered] = useState(false);

  const q = QUESTIONS[questionKey];
  if (!q) return null;

  const submit = async (value) => {
    setAnswered(true);
    try { localStorage.setItem(`survey_${questionKey}_done`, "1"); } catch {}

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(`${SUPABASE_URL}/functions/v1/record-survey-answer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            question_key: questionKey,
            answer: value,
            trigger_context: q.trigger,
          }),
        });
      }
    } catch (e) {
      console.error("survey save error:", e);
    }

    setTimeout(onClose, 1800);
  };

  const dismiss = () => {
    try { localStorage.setItem(`survey_${questionKey}_done`, "dismissed"); } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-right" dir="rtl">
        {!answered ? (
          <>
            <div className="flex items-start justify-between mb-3">
              <button onClick={dismiss} className="text-ink/25 hover:text-ink/50 text-lg leading-none">×</button>
              <span className="text-xs text-ink/35 bg-canvas rounded-full px-2 py-0.5">שאלה אחת 🙏</span>
            </div>
            <p className="font-bold text-ink text-base leading-snug mb-1">{q.text}</p>
            <p className="text-xs text-ink/40 mb-4">{q.sub}</p>
            <div className="space-y-2">
              {q.options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => submit(opt.value)}
                  className="w-full text-right px-4 py-3 rounded-xl border border-ink/10 hover:border-magic/50 hover:bg-magic/5 text-sm text-ink font-medium transition-all active:scale-[0.98]"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🙏</div>
            <p className="font-bold text-ink text-base">תודה רבה!</p>
            <p className="text-xs text-ink/40 mt-1.5 leading-relaxed">
              התשובה שלך תשפיע ישירות<br />על מה שנבנה בחודש הקרוב
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
