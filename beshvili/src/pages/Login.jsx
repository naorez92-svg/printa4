import { useState } from "react";
import { supabase } from "../lib/supabase";

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

export default function Login() {
  const [email, setEmail] = useState("");
  const [step, setStep]   = useState("email"); // "email" | "verify"
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
      const alreadySent = /after \d+ second/i.test(msg) || /rate|security/i.test(msg);
      if (alreadySent) {
        setStep("verify");
      } else {
        setError(msg || "שגיאה בשליחה — נסה שנית");
      }
    } else {
      setStep("verify");
    }
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
      <section className="relative bg-ink py-20 px-5 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-magic/30 to-brand/20 pointer-events-none" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-magic/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-brand/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl mx-auto space-y-6">
          <div className="text-6xl">📚</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-display leading-tight">
            חוברת לימוד מותאמת אישית<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-brand to-[#A78BFA]">
              בפחות מ-60 שניות
            </span>
          </h1>
          <p className="text-xl text-white/65 leading-relaxed max-w-lg mx-auto">
            AI חכם שיוצר חוברת עבודה לפי שם הילד, העולם שלו, והיעד הפדגוגי — מוכנה להדפסה ישר מהדפדפן
          </p>
          <button
            onClick={() => scrollTo("login-form")}
            className="inline-block bg-gradient-to-l from-brand to-magic text-white rounded-2xl px-10 py-4 text-xl font-display font-semibold hover:scale-105 transition-all shadow-2xl shadow-magic/30 active:scale-100"
          >
            ✨ התחל חינם — 2 חוברות במתנה
          </button>
          <p className="text-xs text-white/30">ללא כרטיס אשראי · ללא סיסמה · כניסה קלה במייל</p>
        </div>
      </section>

      {/* ── For whom ── */}
      <section className="py-14 px-5 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-ink mb-2 font-display">מושלם עבור</h2>
          <p className="text-ink/50 mb-10 text-sm">כלי העבודה שכל מי שמלמד ילדים חיכה לו</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: "🎓", title: "מורה פרטית", desc: "חוברת ייחודית לכל תלמיד, בדיוק לפי הקשיים שלו — לא עוד דפי צילום גנריים", bg: "bg-gradient-to-br from-magic/10 to-magic/5", border: "border-magic/20" },
              { icon: "👩‍👧", title: "הורה", desc: "תרגול בעולם שהילד אוהב — כדורגל, גיימינג, חיות. לומד בלי להרגיש שהוא לומד", bg: "bg-gradient-to-br from-brand/15 to-brand/5", border: "border-brand/20" },
              { icon: "🏫", title: "מחנכת", desc: "חוברת חזרה לפני מבחן, מבחן חצי שנתי, חוברת העשרה — בקלות ובמהירות", bg: "bg-gradient-to-br from-grow/10 to-grow/5", border: "border-grow/20" },
            ].map(({ icon, title, desc, bg, border }) => (
              <div key={title} className={`${bg} rounded-2xl p-6 text-center border ${border} shadow-sm`}>
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
              { num: "03", icon: "🖨️", title: "הדפס ומסור", desc: "לחץ הדפס → שמור כ-PDF — מקבל קובץ A4 מוכן, חסכוני בדיו" },
            ].map(({ num, icon, title, desc }) => (
              <div key={num} className="relative bg-white rounded-2xl p-6 border border-ink/5 shadow-sm">
                <div className="absolute -top-3 right-4 text-xs font-bold text-white bg-gradient-to-l from-brand to-magic rounded-full px-2.5 py-1">{num}</div>
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
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-ink mb-2 font-display">מחירים שקופים</h2>
          <p className="text-ink/50 mb-10 text-sm">מתחילים חינם, משדרגים כשרוצים</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

            {/* Free */}
            <div className="bg-white rounded-2xl p-6 border border-ink/10 shadow-sm text-right">
              <div className="text-2xl mb-2">🌱 חינמי</div>
              <div className="text-3xl font-bold text-ink mb-1 font-display">₪0</div>
              <div className="text-xs text-ink/40 mb-4">לתמיד</div>
              <ul className="space-y-2 text-sm text-ink/70 mb-5">
                {["2 חוברות להתנסות", "עד 10 עמודים", "שמירה בענן"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-grow">✓</span>{f}</li>
                ))}
              </ul>
              <button
                onClick={() => scrollTo("login-form")}
                className="block w-full border border-ink/20 text-ink/60 rounded-xl px-4 py-2.5 text-sm font-semibold text-center hover:border-magic/40 hover:text-magic transition-colors"
              >
                התחל חינם ✨
              </button>
            </div>

            {/* Parent */}
            <div className="bg-white rounded-2xl p-6 border border-brand/30 shadow-sm text-right">
              <div className="text-2xl mb-2">🌟 הורה</div>
              <div className="text-3xl font-bold text-brand mb-1 font-display">₪19<span className="text-sm font-normal text-ink/40">/חודש</span></div>
              <div className="text-xs text-ink/40 mb-4">ביטול בכל עת</div>
              <ul className="space-y-2 text-sm text-ink/70 mb-5">
                {["5 חוברות לחודש", "עד 10 עמודים", "מפתח תשובות", "שמירה בענן"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-brand">✓</span>{f}</li>
                ))}
              </ul>
              <a
                href={"https://wa.me/972509139137?text=" + encodeURIComponent("שלום! אני רוצה לשדרג לתוכנית הורה בבשבילי 🌟")}
                target="_blank" rel="noopener noreferrer"
                className="block w-full bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-semibold text-center hover:opacity-90 transition-opacity shadow-sm"
              >
                💙 שדרגי — ₪19
              </a>
            </div>

            {/* Teacher */}
            <div className="bg-gradient-to-br from-brand/10 to-magic/10 rounded-2xl p-6 border border-magic/20 shadow-sm text-right relative overflow-hidden flex flex-col">
              <div className="absolute top-3 left-3 bg-magic text-white text-xs rounded-full px-2.5 py-1 font-semibold">הכי פופולרי</div>
              <div className="text-2xl mb-2">🚀 מורה</div>
              <div className="text-3xl font-bold text-magic mb-1 font-display">₪59<span className="text-sm font-normal text-ink/40">/חודש</span></div>
              <div className="text-xs text-ink/40 mb-4">ביטול בכל עת</div>
              <ul className="space-y-2 text-sm text-ink/70 mb-5 flex-1">
                {["20 חוברות לחודש", "עד 20 עמודים", "מפתח תשובות אוטומטי", "שמירה בענן", "תמיכה אישית"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-magic">✓</span>{f}</li>
                ))}
              </ul>
              <a
                href={"https://wa.me/972509139137?text=" + encodeURIComponent("שלום! אני רוצה לשדרג לתוכנית מורה בבשבילי 🚀")}
                target="_blank" rel="noopener noreferrer"
                className="block w-full bg-[#25D366] text-white rounded-xl px-4 py-2.5 text-sm font-semibold text-center hover:opacity-90 transition-opacity shadow-sm"
              >
                💬 שדרגי — ₪59
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
            {step === "verify" ? (
              <div className="space-y-5 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-brand/20 to-magic/20 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-4xl">✉️</span>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-ink text-xl font-display">בדוק את תיבת הדואר</p>
                  <p className="text-ink/50 text-sm">שלחנו קישור כניסה לכתובת:</p>
                  <p className="text-magic font-semibold text-sm break-all">{email}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 leading-relaxed text-right">
                  <p><strong>לא מצאת?</strong> בדוק ספאם / קידומי מכירות</p>
                  <p className="mt-1">לחץ על הכפתור בתוך המייל — תיכנס ישירות לאפליקציה ✨</p>
                </div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button
                  onClick={() => { setStep("email"); setError(""); }}
                  className="w-full text-sm text-ink/50 hover:text-magic transition-colors border border-ink/15 rounded-xl px-4 py-2.5 hover:border-magic/40"
                >
                  שנה מייל / שלח קישור מחדש
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-ink/60 text-center">כניסה / הרשמה — בלי סיסמה</p>
                <input
                  className="w-full border border-ink/20 rounded-xl p-3 bg-white text-right outline-none focus:border-magic transition-colors"
                  placeholder="כתובת אימייל"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  autoFocus
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
