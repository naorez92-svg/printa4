import { useMemo, useState } from "react";
import { MODULES } from "../data/modules.js";

const EXAM_SIZE = 12;

// ערבוב דטרמיניסטי מספיק טוב למבחן תרגול (לא קריפטוגרפי).
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildExam() {
  const pool = MODULES.flatMap((m) =>
    m.quiz.map((q) => ({ ...q, moduleTitle: m.title, moduleIcon: m.icon }))
  );
  return shuffle(pool).slice(0, EXAM_SIZE);
}

export default function ExamView({ best, onFinish }) {
  const [seed, setSeed] = useState(0);
  const questions = useMemo(buildExam, [seed]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const restart = () => {
    setSeed((s) => s + 1);
    setIndex(0);
    setChosen(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    const msg =
      pct >= 90
        ? "מצוין! אתה מוכן לפקח על כל מערכת בבניין 💪"
        : pct >= 70
        ? "יפה מאוד! עוד סבב קטן על המודולים החלשים ואתה שם."
        : "התחלה טובה — חזרו למודולים וחזרו למבחן. הידע הזה שווה טופס 4 בזמן.";
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-4">
        <div className="text-6xl" aria-hidden>{pct >= 70 ? "🏆" : "📚"}</div>
        <h2 className="font-bold text-2xl">
          {score} מתוך {questions.length} ({pct}%)
        </h2>
        <p className="text-ink/70">{msg}</p>
        {best > 0 && (
          <p className="text-sm font-mono text-magic">שיא אישי: {best}%</p>
        )}
        <button
          onClick={restart}
          className="bg-magic text-white rounded-2xl px-8 py-3 font-bold hover:opacity-90"
        >
          מבחן חדש
        </button>
      </div>
    );
  }

  const q = questions[index];
  const answered = chosen !== null;

  return (
    <div className="space-y-4">
      <header className="bg-ink text-white rounded-2xl p-6">
        <h2 className="font-bold text-2xl mb-1">🎓 מבחן תרגול</h2>
        <p className="text-white/85">
          {EXAM_SIZE} שאלות אקראיות מכל המודולים.
          {best > 0 && <span className="font-mono"> שיא אישי: {best}%</span>}
        </p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between text-sm text-ink/60 mb-4">
          <span className="font-mono">
            שאלה {index + 1}/{questions.length}
          </span>
          <span>
            {q.moduleIcon} {q.moduleTitle}
          </span>
        </div>

        <p className="font-bold text-lg mb-4">{q.q}</p>

        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            let cls = "bg-canvas hover:bg-magic/10 border-transparent";
            if (answered) {
              if (i === q.answer) cls = "bg-grow/15 border-grow";
              else if (i === chosen) cls = "bg-red-100 border-red-400";
              else cls = "bg-canvas opacity-60 border-transparent";
            }
            return (
              <button
                key={i}
                disabled={answered}
                onClick={() => {
                  setChosen(i);
                  if (i === q.answer) setScore((s) => s + 1);
                }}
                className={`text-right rounded-lg border px-4 py-3 transition ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {answered && (
          <>
            <p className={`mt-4 text-sm rounded-lg p-3 ${chosen === q.answer ? "bg-grow/10" : "bg-brand/10"}`}>
              {chosen === q.answer ? "✔️ נכון! " : "✖️ לא מדויק. "}
              {q.explain}
            </p>
            <button
              onClick={() => {
                if (index + 1 >= questions.length) {
                  const finalScore = score; // score כבר עודכן בבחירה
                  const pct = Math.round((finalScore / questions.length) * 100);
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
          </>
        )}
      </div>
    </div>
  );
}
