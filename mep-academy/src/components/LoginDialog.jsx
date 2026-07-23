import { useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";

// התחברות באימייל: שולחים קוד/קישור חד-פעמי, נכנסים בלי סיסמה.
// תומך בשני המסלולים: הקלדת הקוד מהמייל, או לחיצה על הקישור שבו.

export default function LoginDialog({ onClose }) {
  const [step, setStep] = useState("email"); // email | code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);

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
      onKeyDown={(e) => e.key === "Escape" && onClose()}
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
              בלי סיסמאות: מקלידים אימייל, מקבלים קוד חד-פעמי — וההתקדמות שלך
              נשמרת ומסתנכרנת בין כל המכשירים.
            </p>
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
