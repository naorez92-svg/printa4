import { useState } from "react";
import { MODULES, TOTAL_QUIZ_QUESTIONS } from "../data/modules.js";
import { authAvailable, signInWithGoogle } from "../lib/supabase.js";

// דף הנחיתה — המסך הראשון למבקר חדש. מציג מה יש בקורס וכפתור כניסה.

const FEATURES = [
  {
    icon: "🎬",
    title: "18 שיעורים מונפשים",
    desc: "קריינות בעברית, כתוביות ותרשימי זרימה חיים — כמו סרטון, ישר בדפדפן.",
  },
  {
    icon: "✍️",
    title: `${TOTAL_QUIZ_QUESTIONS} שאלות תרגול`,
    desc: "כולל שאלות תרחיש מהשטח, הסבר על כל תשובה, ומבחן עם חזרה על הטעויות.",
  },
  {
    icon: "📖",
    title: "ספריית תקנים ומילון",
    desc: "כל התקנים הישראליים הרלוונטיים, מילון מונחים, והמספרים שחייבים לזכור.",
  },
  {
    icon: "📋",
    title: "מסלול מלא לטופס 4",
    desc: "צ'ק-ליסט אינטראקטיבי של כל האישורים — מהכבאות ועד פיקוד העורף.",
  },
];

const STEPS = [
  { icon: "1️⃣", title: "נרשמים בחינם", desc: "עם Google או אימייל — בלי סיסמאות" },
  { icon: "2️⃣", title: "לומדים בקצב שלכם", desc: "שיעורים מונפשים עם קריינות, מכל מכשיר" },
  { icon: "3️⃣", title: "מתרגלים ומתקדמים", desc: "ההתקדמות האישית שלכם נשמרת ומסתנכרנת" },
];

export default function Landing({ onLogin }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const googleSignIn = async () => {
    setBusy(true);
    setError("");
    const err = await signInWithGoogle();
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 space-y-6">
        <header className="bg-gradient-to-l from-ink to-steel text-white rounded-3xl p-8 text-center">
          <div className="text-6xl mb-3" aria-hidden>⚙️</div>
          <h1 className="font-bold text-3xl md:text-4xl mb-3">אקדמיית MEP</h1>
          <p className="text-white/90 text-lg leading-relaxed">
            הקורס הדיגיטלי למערכות אלקטרומכניות בבנייה — חשמל, מיזוג, אינסטלציה,
            בטיחות אש, מעליות וגז. מהמושג הראשון ועד טופס 4.
          </p>
          <div className="flex justify-center gap-6 mt-6 text-center">
            <div>
              <p className="font-bold text-2xl font-mono">{MODULES.length}</p>
              <p className="text-white/80 text-sm">מודולים</p>
            </div>
            <div>
              <p className="font-bold text-2xl font-mono">152</p>
              <p className="text-white/80 text-sm">שקפי שיעור</p>
            </div>
            <div>
              <p className="font-bold text-2xl font-mono">{TOTAL_QUIZ_QUESTIONS}</p>
              <p className="text-white/80 text-sm">שאלות</p>
            </div>
          </div>
        </header>

        {authAvailable ? (
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-3" aria-label="כניסה">
            <h2 className="font-bold text-lg text-center">הרשמה / כניסה — חינם</h2>
            <p className="text-sm text-ink/70 text-center">
              כל אחד עם המשתמש האישי שלו — ההתקדמות נשמרת רק לך, בכל מכשיר.
            </p>
            <button
              onClick={googleSignIn}
              disabled={busy}
              className="w-full bg-white border-2 border-ink/15 rounded-2xl py-3.5 font-bold text-lg hover:border-magic transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              התחברות עם Google
            </button>
            <button
              onClick={onLogin}
              className="w-full bg-magic text-white rounded-2xl py-3.5 font-bold text-lg hover:opacity-90 transition"
            >
              ✉️ התחברות עם אימייל
            </button>
            <p role="status" className={error ? "text-sm text-red-700 bg-red-50 rounded-xl p-3" : "sr-only"}>
              {error}
            </p>
          </section>
        ) : (
          <p className="bg-white rounded-2xl shadow-sm p-5 text-center text-ink/70">
            ⚠️ ההתחברות אינה זמינה בסביבה זו.
          </p>
        )}

        <section className="bg-white rounded-2xl shadow-sm p-5" aria-label="איך זה עובד">
          <h2 className="font-bold text-lg mb-4 text-center">איך זה עובד?</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.title} className="text-center">
                <p className="text-3xl mb-1" aria-hidden>{s.icon}</p>
                <p className="font-bold">{s.title}</p>
                <p className="text-sm text-ink/70 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-4" aria-label="מה מקבלים בקורס">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-3xl mb-2" aria-hidden>{f.icon}</p>
              <h2 className="font-bold text-lg mb-1">{f.title}</h2>
              <p className="text-ink/80 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-5" aria-label="נושאי הקורס">
          <h2 className="font-bold text-lg mb-3">📚 מה לומדים? כל 18 המודולים</h2>
          <div className="flex flex-wrap gap-2">
            {MODULES.map((m) => (
              <span key={m.id} className="bg-canvas rounded-full px-3 py-1.5 text-sm font-semibold">
                <span aria-hidden>{m.icon}</span> {m.title.split(" — ")[0]}
              </span>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-lg mb-2">🎯 למי זה מתאים?</h2>
          <p className="leading-relaxed text-ink/90">
            מהנדסים והנדסאים בתחילת הדרך, מנהלי עבודה ומפקחים שרוצים להתמקצע
            במערכות, מנהלי פרויקטים שרוצים לדבר עם היועצים בגובה העיניים — וכל מי
            שמתכונן לתפקיד או לראיון בעולם ה-MEP.
          </p>
        </section>
      </main>

      <footer className="w-full max-w-2xl mx-auto px-4 pb-6 text-center text-xs text-ink/70">
        התכנים להעשרה מקצועית — אינם תחליף לייעוץ הנדסי או לנוסח המחייב של התקנים
      </footer>
    </div>
  );
}
