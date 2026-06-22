import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (err) {
      const msg = err.message || "";
      const waitMatch = msg.match(/after (\d+) second/);
      if (waitMatch) {
        setError(`שלחנו מייל לאחרונה — המתן ${waitMatch[1]} שניות ונסה שנית`);
      } else if (msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("security")) {
        setError("שלחנו מייל לאחרונה — המתן דקה ונסה שנית");
      } else {
        setError(msg || "שגיאה בשליחה — נסה שנית");
      }
    }
    else setSent(true);
  };

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      {/* Hero */}
      <div className="flex-1 bg-gradient-to-br from-brand/10 via-magic/5 to-grow/10 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 text-center">

          {/* Logo */}
          <div className="space-y-2">
            <div className="text-6xl">📚</div>
            <h1 className="text-4xl font-bold text-ink font-display">בשבילי</h1>
            <p className="text-ink/60 text-lg">חוברות לימוד אישיות — בול בשבילי</p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ["✨", "AI מייצר", "חוברת מלאה"],
              ["🖨️", "מוכן להדפסה", "A4 מיידי"],
              ["☁️", "נשמר בענן", "בכל מכשיר"],
            ].map(([icon, t1, t2]) => (
              <div key={t1} className="bg-white/70 rounded-2xl p-3 space-y-1">
                <div className="text-2xl">{icon}</div>
                <div className="text-xs font-semibold text-ink">{t1}</div>
                <div className="text-xs text-ink/50">{t2}</div>
              </div>
            ))}
          </div>

          {/* Auth card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-ink/5 space-y-4">
            {sent ? (
              <div className="space-y-3">
                <div className="text-4xl">✉️</div>
                <p className="text-grow font-semibold">שלחנו קישור למייל שלך!</p>
                <p className="text-ink/50 text-sm">לחץ על הקישור במייל כדי להיכנס</p>
                <button
                  onClick={() => { setSent(false); setEmail(""); }}
                  className="text-xs text-ink/40 hover:text-ink/60 underline"
                >
                  שלח שוב
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-semibold text-ink">כניסה / הרשמה</h2>
                <p className="text-sm text-ink/50">נשלח לך קישור כניסה למייל — בלי סיסמה</p>
                <input
                  className="w-full border border-ink/20 rounded-xl p-3 bg-canvas/50 text-right outline-none focus:border-magic transition-colors"
                  placeholder="כתובת אימייל"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  autoFocus
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  onClick={send}
                  disabled={loading || !email.trim()}
                  className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3 font-display font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity shadow-sm"
                >
                  {loading ? "שולח…" : "שלחו לי קישור ✉️"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-ink/25">
        בשבילי · יוצר חוברות לימוד AI
      </footer>
    </div>
  );
}
