import { MODULES, TOTAL_QUIZ_QUESTIONS } from "../data/modules.js";
import { authAvailable } from "../lib/supabase.js";

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

export default function Landing({ onStart, onLogin }) {
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

        <button
          onClick={onStart}
          className="w-full bg-brand text-ink rounded-2xl py-4 font-bold text-xl hover:opacity-90 transition"
        >
          🚀 התחל ללמוד — חינם
        </button>
        {authAvailable && (
          <button
            onClick={onLogin}
            className="w-full bg-white border border-ink/15 rounded-2xl py-3 font-semibold hover:border-magic transition"
          >
            ✉️ כבר לומדים? התחברות לסנכרון ההתקדמות
          </button>
        )}

        <section className="grid sm:grid-cols-2 gap-4" aria-label="מה מקבלים בקורס">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-3xl mb-2" aria-hidden>{f.icon}</p>
              <h2 className="font-bold text-lg mb-1">{f.title}</h2>
              <p className="text-ink/80 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
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
