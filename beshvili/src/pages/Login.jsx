import { useState } from "react";
import { supabase } from "../lib/supabase";

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

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
      const isRateLimit = msg.match(/after (\d+) second/) || msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("security");
      if (isRateLimit) {
        // OTP was already sent in a previous attempt — show success state
        setSent(true);
      } else {
        setError(msg || "שגיאה בשליחה — נסה שנית");
      }
    } else setSent(true);
  };

  return (
    <div className="min-h-screen bg-canvas" dir="rtl">

      {/* ── Sticky nav ── */}
      <nav className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-ink/5">
        <div className="max-w-4xl mx-auto px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <span className="font-bold text-ink text-lg font-display">בשבילי<span className="text-brand">·</span></span>
          </div>
          <button
            onClick={() => scrollTo("login-form")}
            className="bg-gradient-to-l from-brand to-magic text-white text-sm rounded-xl px-4 py-2 font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            כניסה חינמית ✨
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-brand/10 via-magic/5 to-grow/10 py-16 px-5 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-7xl">📚</div>
          <h1 className="text-4xl font-bold text-ink font-display leading-tight">
            חוברת לימוד מותאמת אישית<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-brand to-magic">
              בפחות מ-60 שניות
            </span>
          </h1>
          <p className="text-xl text-ink/60 leading-relaxed max-w-lg mx-auto">
            AI חכם שיוצר חוברת עבודה לפי שם הילד, העולם שלו, והיעד הפדגוגי — מוכנה להדפסה ישר מהדפדפן
          </p>
          <button
            onClick={() => scrollTo("login-form")}
            className="inline-block bg-gradient-to-l from-brand to-magic text-white rounded-2xl px-8 py-4 text-lg font-display font-semibold hover:opacity-90 transition-opacity shadow-md"
          >
            ✨ התחל חינם — 2 חוברות במתנה
          </button>
          <p className="text-xs text-ink/30">ללא כרטיס אשראי · ללא סיסמא · כניסה קלה במייל</p>
        </div>
      </section>

      {/* ── For whom ── */}
      <section className="py-14 px-5 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-ink mb-2 font-display">מושלם עבור</h2>
          <p className="text-ink/50 mb-10 text-sm">כלי העבודה שכל מי שמלמד ילדים חיכה לו</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: "🎓", title: "מורה פרטית", desc: "חוברת ייחודית לכל תלמיד, בדיוק לפי הקשיים שלו — לא עוד דפי צילום גנריים" },
              { icon: "👩‍👧", title: "הורה", desc: "תרגול בעולם שהילד אוהב — כדורגל, גיימינג, חיות. לומד בלי להרגיש שהוא לומד" },
              { icon: "🏫", title: "מחנכת", desc: "חוברת חזרה לפני מבחן, מבחן חצי שנתי, חוברת העשרה — בקלות ובמהירות" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-canvas rounded-2xl p-6 text-center border border-ink/5">
                <div className="text-4xl mb-3">{icon}</div>
                <h3 className="font-bold text-ink mb-2 font-display">{title}</h3>
                <p className="text-ink/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-14 px-5 bg-canvas">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-ink mb-2 font-display">איך זה עובד?</h2>
          <p className="text-ink/50 mb-10 text-sm">3 שלבים פשוטים — תוך פחות מדקה</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { num: "01", icon: "✍️", title: "מלא פרטי הילד", desc: "שם, כיתה, העולם האהוב, יעד פדגוגי — או פשוט כתוב מה תרצה בחופשיות" },
              { num: "02", icon: "⚡", title: "AI יוצר תוך שניות", desc: "מערכת ה-AI מייצרת חוברת עבודה מלאה עם תרגילים, עמודים ואיור — הכל בעברית" },
              { num: "03", icon: "🖨️", title: "הדפס ומסור", desc: "לחץ הדפס → שמור כע-PDF — מקבל קובץ A4 מוכן, חסכוני בדיו" },
            ].map(({ num, icon, title, desc }) => (
              <div key={num} className="relative bg-white rounded-2xl p-6 border border-ink/5 shadow-sm">
                <div className="absolute -top-3 right-4 text-xs font-bold text-brand bg-brand/10 rounded-full px-2.5 py-0.5">{num}</div>
                <div className="text-3xl mb-3 mt-2">{icon}</div>
                <h3 className="font-bold text-ink mb-2">{title}</h3>
                <p className="text-ink/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-14 px-5 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-ink mb-2 font-display">מה מקבלים?</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: "🎯", title: "אישי לחלוטין", desc: "לפי שם, כיתה, עולם תוכן וקשיים ספציפיים" },
              { icon: "📄", title: "3–10 עמודים", desc: "שער אישי, תרגילים, חשיבה, רפלקציה" },
              { icon: "🔑", title: "מפתח תשובות", desc: "דף תשובות נפרד לשימוש המורה" },
              { icon: "☁️", title: "שמור בענן", desc: "כל החוברות שיצרת — גישה מכל מכשיר" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-canvas rounded-2xl p-4 text-center border border-ink/5">
                <div className="text-3xl mb-2">{icon}</div>
                <div className="font-semibold text-sm text-ink mb-1">{title}</div>
                <div className="text-xs text-ink/50">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-14 px-5 bg-canvas">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-ink mb-2 font-display">מחירים שקופים</h2>
          <p className="text-ink/50 mb-10 text-sm">מתחילים חינם, משדרגים כשרוצים</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-ink/10 shadow-sm text-right">
              <div className="text-2xl mb-2">🌱 חינמי</div>
              <div className="text-3xl font-bold text-ink mb-1 font-display">₪0</div>
              <div className="text-xs text-ink/40 mb-4">לתמיד</div>
              <ul className="space-y-2 text-sm text-ink/70">
                {["2 חוברות להתנסות", "עד 10 עמודים", "שמירה בענן"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-grow">✓</span>{f}</li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-brand/10 to-magic/10 rounded-2xl p-6 border border-magic/20 shadow-sm text-right relative overflow-hidden flex flex-col gap-4">
              <div className="absolute top-3 left-3 bg-magic text-white text-xs rounded-full px-2.5 py-1 font-semibold">הכי פופולרי</div>
              <div>
                <div className="text-2xl mb-2">🚀 פרו</div>
                <div className="text-3xl font-bold text-ink mb-1 font-display">₪30<span className="text-sm font-normal text-ink/40">/חודש</span></div>
                <div className="text-xs text-ink/40 mb-4">ביטול בכל עת</div>
                <ul className="space-y-2 text-sm text-ink/70">
                  {["חוברות ללא הגבלה", "עד 20 עמודים", "מפתח תשובות אוטומטי", "שמירה בענן", "תמיכה אישית"].map((f) => (
                    <li key={f} className="flex items-center gap-2"><span className="text-magic">✓</span>{f}</li>
                  ))}
                </ul>
              </div>
              <a
                href={"https://wa.me/972509139137?text=" + encodeURIComponent("שלום! אני רוצה לשדרג לבשבילי פרו 🚀")}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-[#25D366] text-white rounded-xl px-4 py-2.5 text-sm font-semibold text-center hover:opacity-90 transition-opacity shadow-sm"
              >
                💬 שדרגי לפרו
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Login form ── */}
      <section id="login-form" className="py-16 px-5 bg-white">
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-ink font-display mb-2">מוכן להתחיל?</h2>
            <p className="text-ink/50">ההרשמה חינמית — ללא כרטיס אשראי</p>
          </div>
          <div className="bg-canvas rounded-2xl p-6 border border-ink/10 shadow-sm">
            {sent ? (
              <div className="space-y-3 text-center">
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
              <div className="space-y-4">
                <p className="text-sm text-ink/60 text-center">כניסה / הרשמה — בלי סיסמא, קישור ישיר למייל</p>
                <input
                  className="w-full border border-ink/20 rounded-xl p-3 bg-white text-right outline-none focus:border-magic transition-colors"
                  placeholder="כתובת אימייל"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button
                  onClick={send}
                  disabled={loading || !email.trim()}
                  className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3.5 font-display font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity shadow-sm"
                >
                  {loading ? "שולח…" : "שלחו לי קישור ✉️"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-canvas border-t border-ink/5 py-8 px-5 text-center text-xs text-ink/25">
        <div className="flex justify-center gap-4 flex-wrap mb-2">
          <a href="https://wa.me/972509139137" target="_blank" rel="noopener noreferrer" className="hover:text-ink/50 transition-colors">צור קשר</a>
          <span>·</span>
          <a href="/privacy.html" target="_blank" className="hover:text-ink/50 transition-colors">מדיניות פרטיות</a>
          <span>·</span>
          <a href="/terms.html" target="_blank" className="hover:text-ink/50 transition-colors">תנאי שימוש</a>
          <span>·</span>
          <a href="/accessibility.html" target="_blank" className="hover:text-ink/50 transition-colors">נגישות</a>
        </div>
        <p>בשבילי © {new Date().getFullYear()} · כל הזכויות שמורות</p>
      </footer>
    </div>
  );
}
