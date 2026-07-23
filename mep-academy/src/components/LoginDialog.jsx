import { useEffect, useRef, useState } from "react";
import { supabase, signInWithGoogle } from "../lib/supabase.js";

// התחברות באימייל: שולחים קוד/קישור חד-פעמי, נכנסים בלי סיסמה.
// תומך בשני המסלולים: הקלדת הקוד מהמייל, או לחיצה על הקישור שבו.

export default function LoginDialog({ onClose }) {
  const [step, setStep] = useState("email"); // email | code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);

  // Escape סוגר גם כשהפוקוס מחוץ לדיאלוג (למשל אחרי מעבר לשלב הקוד)
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const googleSignIn = async () => {
    setBusy(true);
    setError("");
    // בהצלחה הדפדפן עוזב לעמוד של גוגל — הכפתור נשאר נעול עד הניווט
    const err = await signInWithGoogle();
    if (err) {
      setBusy(false);
      setError(err);
    }
  };

  const sendCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (err) setError("שליחת המייל נכשלה — בדקו את הכתובת ונסו שוב.");
    else setStep("code");
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (err) setError("הקוד לא נכון או שפג תוקפו — נסו שוב או השתמשו בקישור שבמייל.");
    else onClose(); // onAuthStateChange ב-App יתפוס את הכניסה
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="התחברות"
      className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-xl">✉️ התחברות</h1>
          <button
            onClick={onClose}
            className="rounded-xl bg-canvas hover:bg-ink/10 px-3 py-1.5 font-bold"
          >
            ✕<span className="sr-only">סגירה</span>
          </button>
        </div>

        {step === "email" && (
          <form onSubmit={sendCode} className="space-y-3">
            <p className="text-ink/80 leading-relaxed text-sm">
              ההתקדמות שלך תישמר ותסתנכרן בין כל המכשירים.
            </p>
            <button
              type="button"
              onClick={googleSignIn}
              disabled={busy}
              className="w-full bg-white border-2 border-ink/15 rounded-2xl py-3 font-bold hover:border-magic transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              התחברות עם Google
            </button>
            <div className="flex items-center gap-3 text-ink/50 text-sm">
              <span className="flex-1 border-t border-ink/10" aria-hidden />
              או עם אימייל
              <span className="flex-1 border-t border-ink/10" aria-hidden />
            </div>
            <input
              type="email"
              required
              autoFocus
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="כתובת אימייל"
              className="w-full rounded-2xl border border-ink/15 px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-magic"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-magic text-white rounded-2xl py-3 font-bold hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "שולח..." : "שלחו לי קוד כניסה"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode} className="space-y-3">
            <p role="status" className="text-sm bg-grow/10 rounded-xl p-3 leading-relaxed">
              📬 נשלח מייל אל <bdi className="font-mono">{email}</bdi>. אפשר{" "}
              <strong>ללחוץ על הקישור שבמייל</strong> (נפתח מחובר) — או להקליד כאן
              את הקוד:
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              aria-label="קוד חד-פעמי מהמייל"
              className="w-full rounded-2xl border border-ink/15 px-4 py-3 text-center font-mono text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-magic"
            />
            <button
              type="submit"
              disabled={busy || code.trim().length < 6}
              className="w-full bg-magic text-white rounded-2xl py-3 font-bold hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "בודק..." : "כניסה"}
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full text-magic font-semibold text-sm hover:underline"
            >
              כתובת אחרת / שליחה מחדש
            </button>
          </form>
        )}

        <p role="status" className={error ? "text-sm text-red-700 bg-red-50 rounded-xl p-3" : "sr-only"}>
          {error}
        </p>
      </div>
    </div>
  );
}
