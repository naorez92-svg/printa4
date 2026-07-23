import { useEffect, useMemo, useRef, useState } from "react";
import { MODULES, TOTAL_QUIZ_QUESTIONS } from "../data/modules.js";

const EXAM_SIZE = 12;

// ערבוב אקראי (Fisher–Yates) — למבחן תרגול, לא לצרכים קריפטוגרפיים.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// מערבבים גם את סדר התשובות בכל שאלה — אחרת "התשובה הנכונה" תמיד באותו מקום.
function shuffleOptions(q) {
  const order = shuffle(q.options.map((_, i) => i));
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    answer: order.indexOf(q.answer),
  };
}

function buildExam() {
  const pool = MODULES.flatMap((m) =>
    m.quiz.map((q) => ({ ...q, moduleTitle: m.title, moduleIcon: m.icon }))
  );
  return shuffle(pool).slice(0, EXAM_SIZE).map(shuffleOptions);
}

export default function ExamView({ best, onFinish }) {
  const [attempt, setAttempt] = useState(0);
  const questions = useMemo(buildExam, [attempt]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [mistakes, setMistakes] = useState([]);
  const counterRef = useRef(null);

  // הנגשה: בהחלפת שאלה מחזירים את הפוקוס לראש הכרטיס כדי שקוראי מסך
  // ומשתמשי מקלדת ידעו שהשאלה התחלפה.
  useEffect(() => {
    if (index > 0) counterRef.current?.focus();
  }, [index]);

  const hasAttempted = best !== null && best !== undefined;

  const restart = () => {
    setAttempt((s) => s + 1);
    setIndex(0);
    setChosen(null);
    setScore(0);
    setFinished(false);
    setMistakes([]);
    // מסך התוצאות נעלם וכפתור 'מבחן חדש' מתפרק — מחזירים את הפוקוס לראש המבחן
    requestAnimationFrame(() => counterRef.current?.focus());
  };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    const msg =
      pct >= 90
        ? "מצוין! רמת שליטה של מפקח בכיר 💪"
        : pct >= 70
        ? "יפה מאוד! עוד סבב קצר על המודולים החלשים — והציון המלא בהישג יד."
        : "התחלה טובה — כדאי לחזור למודולים ולגשת שוב למבחן. הידע הזה שווה טופס 4 בזמן.";
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-4">
        <div className="text-6xl" aria-hidden>{pct >= 70 ? "🏆" : "📚"}</div>
        <h1 className="font-bold text-2xl">
          {score} מתוך {questions.length} ({pct}%)
        </h1>
        <p className="text-ink/80">{msg}</p>
        {hasAttempted && (
          <p className="text-sm font-mono text-magic">שיא אישי: {best}%</p>
        )}
        <button
          onClick={restart}
          className="bg-magic text-white rounded-2xl px-8 py-3 font-bold hover:opacity-90"
        >
          מבחן חדש
        </button>

        {mistakes.length > 0 && (
          <section className="text-right pt-4 border-t border-ink/10">
            <h2 className="font-bold text-lg mb-3">📝 חזרה על הטעויות ({mistakes.length})</h2>
            <div className="space-y-3">
              {mistakes.map((m, i) => (
                <div key={i} className="bg-canvas rounded-xl p-4 text-sm space-y-2">
                  <p className="text-xs text-ink/70">
                    {m.moduleIcon} {m.moduleTitle}
                  </p>
                  <p className="font-bold">{m.q}</p>
                  <p className="text-red-700">✖️ ענית: {m.chosen}</p>
                  <p className="text-growdeep font-semibold">✔️ הנכון: {m.correct}</p>
                  <p className="text-ink/80 leading-relaxed">{m.explain}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink/70 mt-3">
              💡 טיפ: חזרו למודולים של השאלות שפספסתם — ואז גשו למבחן חדש.
            </p>
          </section>
        )}
      </div>
    );
  }

  const q = questions[index];
  const answered = chosen !== null;

  return (
    <div className="space-y-4">
      <header className="bg-ink text-white rounded-2xl p-6">
        <h1 className="font-bold text-2xl mb-1">🎓 מבחן תרגול</h1>
        <p className="text-white/90">
          {EXAM_SIZE} שאלות אקראיות מתוך מאגר של {TOTAL_QUIZ_QUESTIONS} שאלות.
          {hasAttempted && <span className="font-mono"> שיא אישי: {best}%</span>}
        </p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between text-sm text-ink/70 mb-4">
          <span className="font-mono" ref={counterRef} tabIndex={-1}>
            שאלה {index + 1}/{questions.length}
          </span>
          <span>
            {q.moduleIcon} {q.moduleTitle}
          </span>
        </div>

        <p className="font-bold text-lg mb-4" id="exam-question">{q.q}</p>

        <div className="grid gap-2" role="group" aria-labelledby="exam-question">
          {q.options.map((opt, i) => {
            let cls = "bg-canvas hover:bg-magic/10 border-transparent";
            let hint = "";
            if (answered) {
              if (i === q.answer) {
                cls = "bg-grow/15 border-grow";
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
                  if (answered) return;
                  setChosen(i);
                  if (i === q.answer) setScore((s) => s + 1);
                  else
                    setMistakes((m) => [
                      ...m,
                      {
                        q: q.q,
                        chosen: q.options[i],
                        correct: q.options[q.answer],
                        explain: q.explain,
                        moduleTitle: q.moduleTitle,
                        moduleIcon: q.moduleIcon,
                      },
                    ]);
                }}
                className={`text-right rounded-lg border px-4 py-3 transition ${cls}`}
              >
                {opt}
                {hint && <span className="sr-only">{hint}</span>}
              </button>
            );
          })}
        </div>

        {/* אזור חי קבוע — קיים עוד לפני שיש תוכן, כדי שקוראי מסך יכריזו על המשוב */}
        <p
          role="status"
          className={
            answered
              ? `mt-4 text-sm rounded-lg p-3 ${chosen === q.answer ? "bg-grow/10" : "bg-brand/10"}`
              : "sr-only"
          }
        >
          {answered
            ? `${chosen === q.answer ? "✔️ נכון! " : "✖️ לא מדויק. "}${q.explain}`
            : ""}
        </p>

        {answered && (
          <button
            onClick={() => {
              if (index + 1 >= questions.length) {
                const pct = Math.round((score / questions.length) * 100);
                onFinish(pct);
                setFinished(true);
              } else {
                setIndex((i) => i + 1);
                setChosen(null);
              }
            }}
            className="mt-4 w-full bg-magic text-white rounded-2xl py-3 font-bold hover:opacity-90"
          >
            {index + 1 >= questions.length ? "סיום המבחן" : "לשאלה הבאה"}
          </button>
        )}
      </div>
    </div>
  );
}
