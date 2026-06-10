import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (!error) setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-4xl font-bold text-brand">בשבילי</h1>
        <p className="text-ink/70">כל חוברת — בול בשבילי.</p>
        {sent ? (
          <p className="text-grow font-medium">שלחנו קישור התחברות למייל שלך ✓</p>
        ) : (
          <>
            <input
              className="w-full border border-ink/20 rounded-xl p-3 bg-white text-right outline-none focus:border-magic"
              placeholder="כתובת אימייל"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button
              onClick={send}
              disabled={loading || !email.trim()}
              className="w-full bg-brand text-white rounded-xl p-3 font-display font-semibold disabled:opacity-50 hover:bg-brand/90 transition-colors"
            >
              {loading ? "שולח…" : "שלחו לי קישור"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
