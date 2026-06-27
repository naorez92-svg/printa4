import { useState } from "react";
import { supabase } from "../lib/supabase";
import { track } from "../hooks/useEvents";

const QUICK = [
  "🤩 מדהים! עוזר לי הרבה",
  "👍 טוב, אבל יש מה לשפר",
  "🐛 יש באג שמפריע לי",
  "💡 יש לי רעיון לפיצ'ר",
  "❓ יש לי שאלה",
];

export default function FeedbackWidget() {
  const [open, setOpen]         = useState(false);
  const [selected, setSelected] = useState("");
  const [message, setMessage]   = useState("");
  const [sending, setSending]   = useState(false);
  const [done, setDone]         = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const close = () => { track("feedback_closed", { submitted: done }); setOpen(false); };

  const submit = async () => {
    const text = [selected, message.trim()].filter(Boolean).join("\n");
    if (!text) return;
    setSending(true);
    setSubmitError(false);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("feedback").insert({ user_id: user?.id ?? null, message: text });
    setSending(false);
    if (error) { setSubmitError(true); } else { setDone(true); track("feedback_submitted", { category: selected || null, has_message: !!message.trim() }); }
  };

  const reset = () => { track("feedback_closed", { submitted: true }); setOpen(false); setDone(false); setSelected(""); setMessage(""); setSubmitError(false); };

  if (!open) {
    return (
      <button
        onClick={() => { track("feedback_opened", {}); setOpen(true); }}
        className="fixed bottom-6 left-4 z-40 bg-white border border-ink/10 shadow-lg rounded-full px-4 py-2.5 text-sm font-medium text-ink/50 hover:text-ink hover:shadow-xl transition-all flex items-center gap-2"
      >
        <span>💬</span> פידבק
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/30 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && close()}
    >
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-ink text-lg">ספרי לנו 💬</h3>
          <button onClick={close} className="text-ink/30 hover:text-ink text-3xl leading-none">×</button>
        </div>

        {done ? (
          <div className="text-center py-4 space-y-3">
            <div className="text-5xl">🙏</div>
            <p className="font-semibold text-ink">תודה על הפידבק!</p>
            <p className="text-sm text-ink/50">הפידבק שלך עוזר לנו לשפר את בשבילי</p>
            <button
              onClick={reset}
              className="text-xs text-ink/40 underline hover:text-ink/60"
            >
              סגור
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {QUICK.map(opt => (
                <button
                  key={opt}
                  onClick={() => setSelected(selected === opt ? "" : opt)}
                  className={`w-full text-right text-sm px-4 py-2.5 rounded-xl border transition-colors ${
                    selected === opt
                      ? "bg-magic/10 border-magic/40 text-magic font-medium"
                      : "border-ink/10 text-ink/60 hover:border-ink/25 hover:text-ink"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <textarea
              className="w-full border border-ink/20 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm resize-none"
              placeholder="ספרי לנו עוד... (אופציונלי)"
              rows={2}
              value={message}
              onChange={e => setMessage(e.target.value)}
            />

            {submitError && (
              <p className="text-red-500 text-xs text-center">שגיאה בשליחה — נסי שוב</p>
            )}
            <button
              onClick={submit}
              disabled={sending || (!selected && !message.trim())}
              className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3 font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity shadow-sm"
            >
              {sending ? "שולח..." : "שלחי פידבק ✨"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
