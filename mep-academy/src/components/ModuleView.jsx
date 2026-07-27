import { Suspense, lazy, useMemo, useRef, useState } from "react";
import { LESSON_SLIDES, hasLesson } from "../data/lessonsMeta.js";
import { qid } from "../lib/stats.js";
import ErrorBoundary from "./ErrorBoundary.jsx";

// נגן השיעורים (כולל קובץ השיעורים המלא והתרשימים) נטען עצל — רק כשלוחצים
// על "צפייה בשיעור", לא בטעינת האפליקציה
const LessonPlayer = lazy(() => import("./LessonPlayer.jsx"));

// ערבוב סדר התשובות (Fisher–Yates) — בלעדיו התשובה הנכונה יושבת תמיד באותו מקום
function shuffleOptions(q) {
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    answer: order.indexOf(q.answer),
  };
}

function Section({ icon, title, children, printHide }) {
  return (
    <section className={`bg-white rounded-2xl shadow-sm p-5${printHide ? " print-hide" : ""}`}>
      <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
        <span aria-hidden>{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function QuizQuestion({ index, item, chosen, onChoose }) {
  const answered = chosen !== undefined;
  return (
    <fieldset className="border border-ink/10 rounded-xl p-4">
      <legend className="sr-only">שאלה {index + 1}</legend>
      <p className="font-semibold mb-3" id={`quiz-q-${index}`}>
        {index + 1}. {item.q}
      </p>
      <div className="grid gap-2" role="group" aria-labelledby={`quiz-q-${index}`}>
        {item.options.map((opt, i) => {
          let cls = "bg-canvas hover:bg-magic/10 border-transparent";
          let hint = "";
          if (answered) {
            if (i === item.answer) {
              cls = "bg-grow/15 border-grow text-ink";
              hint = " (התשובה הנכונה)";
            } else if (i === chosen) {
              cls = "bg-red-100 border-red-400";
              hint = " (התשובה שבחרת)";
            } else cls = "bg-canvas opacity-60 border-transparent";
          }
          return (
            <button
              key={i}
              aria-disabled={answered}
              onClick={() => {
                if (!answered) onChoose(i);
              }}
              className={`text-right rounded-lg border px-3 py-2 transition ${cls}`}
            >
              {opt}
              {hint && <span className="sr-only">{hint}</span>}
            </button>
          );
        })}
      </div>
      {/* אזור חי קבוע — קיים לפני שיש תוכן, כדי שקוראי מסך יכריזו על המשוב */}
      <p
        role="status"
        className={
          answered
            ? `mt-3 text-sm rounded-lg p-3 ${chosen === item.answer ? "bg-grow/10" : "bg-brand/10"}`
            : "sr-only"
        }
      >
        {answered
          ? `${chosen === item.answer ? "✔️ נכון! " : "✖️ לא מדויק. "}${item.explain}`
          : ""}
      </p>
    </fieldset>
  );
}

export default function ModuleView({ module, done, onToggleDone, onAnswer, onBack }) {
  const [answers, setAnswers] = useState({});
  const [lessonOpen, setLessonOpen] = useState(false);
  const quizRef = useRef(null);
  const withLesson = hasLesson(module.id);
  const slideCount = LESSON_SLIDES[module.id] || 0;
  // מערבבים פעם אחת לכל כניסה למודול — סדר יציב בזמן המענה
  const quiz = useMemo(() => module.quiz.map(shuffleOptions), [module.id]);

  return (
    <div className="space-y-4">
      {lessonOpen && withLesson && (
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="fixed inset-0 z-50 bg-ink text-white flex items-center justify-center">
                <p role="status" className="text-2xl animate-pulse">
                  <span aria-hidden>▶️</span>
                  <span className="sr-only">טוען את השיעור</span>
                </p>
              </div>
            }
          >
            <LessonPlayer
              moduleId={module.id}
              onClose={(reason) => {
                setLessonOpen(false);
                // בסיום השיעור — קופצים ישר לתרגול, כמו שהקריינות מבטיחה
                if (reason === "finished")
                  setTimeout(() => quizRef.current?.scrollIntoView({ block: "start" }), 60);
              }}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      <button onClick={onBack} className="text-magic font-semibold hover:underline print-hide">
        <span aria-hidden>→ </span>חזרה לכל המודולים
      </button>

      <header className="bg-ink text-white rounded-2xl p-6">
        <div className="text-4xl mb-2" aria-hidden>{module.icon}</div>
        <h1 className="font-bold text-2xl mb-2">{module.title}</h1>
        <p className="text-white/90 leading-relaxed">{module.summary}</p>
        {withLesson && (
          <button
            onClick={() => setLessonOpen(true)}
            className="mt-4 w-full bg-brand text-ink rounded-2xl py-3.5 px-4 font-bold text-lg hover:opacity-90 transition flex items-center justify-center gap-2 print-hide"
          >
            <span aria-hidden>▶️</span>
            צפייה בשיעור המונפש ({slideCount} פרקים, ~
            {Math.max(5, Math.round(slideCount * 0.9))} דק')
          </button>
        )}
      </header>

      <Section icon="🎯" title="נקודות המפתח">
        <ul className="space-y-2">
          {module.points.map((p, i) => (
            <li key={i} className="flex gap-2 leading-relaxed print-item">
              <span className="text-grow font-bold shrink-0">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon="📖" title="תקנים ורגולציה">
        <ul className="space-y-2">
          {module.standards.map((s, i) => (
            <li key={i} className="bg-canvas rounded-lg px-3 py-2 text-sm leading-relaxed print-item">
              {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon="⚠️" title="ליקויים נפוצים בשטח">
        <ul className="space-y-2">
          {module.pitfalls.map((p, i) => (
            <li key={i} className="flex gap-2 leading-relaxed text-sm print-item">
              <span className="text-brand font-bold shrink-0" aria-hidden>!</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      {module.intl?.length > 0 && (
        <Section icon="🌍" title="העשרה בינלאומית — מותאם לשוק הישראלי">
          <ul className="space-y-2">
            {module.intl.map((p, i) => (
              <li key={i} className="bg-magic/5 border border-magic/20 rounded-lg px-3 py-2 text-sm leading-relaxed print-item">
                {p}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <button
        onClick={() => window.print()}
        className="w-full text-center text-ink/60 text-sm font-semibold hover:text-ink py-1 print-hide"
      >
        🖨️ הדפסת תקציר המודול (או שמירה כ-PDF)
      </button>

      <div ref={quizRef} />
      <Section icon="✍️" title="תרגול" printHide>
        <div className="space-y-4">
          {quiz.map((item, i) => (
            <QuizQuestion
              key={i}
              index={i}
              item={item}
              chosen={answers[i]}
              onChoose={(choice) => {
                setAnswers((a) => ({ ...a, [i]: choice }));
                // מזין את החזרה המרווחת ואת סטטיסטיקת השליטה — לפי מיקום
                // השאלה במאגר המקורי (i הוא אינדקס יציב של module.quiz)
                onAnswer?.(module.id, qid(module.id, i), choice === item.answer);
              }}
            />
          ))}
        </div>
      </Section>

      <button
        onClick={onToggleDone}
        aria-pressed={done}
        className={`w-full rounded-2xl py-4 font-bold text-lg transition print-hide ${
          done ? "bg-growdeep text-white" : "bg-magic text-white hover:opacity-90"
        }`}
      >
        {done ? "✔️ המודול הושלם — לחיצה לביטול" : "סיימתי את המודול"}
      </button>

      <button onClick={onBack} className="w-full text-center text-magic font-semibold hover:underline py-2 print-hide">
        <span aria-hidden>→ </span>חזרה לכל המודולים
      </button>
    </div>
  );
}
