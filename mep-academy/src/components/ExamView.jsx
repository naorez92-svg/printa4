import { memo, useEffect, useMemo, useRef, useState } from "react";
import { MODULES, TOTAL_QUIZ_QUESTIONS } from "../data/modules.js";
import { isDue, qid, weakestModules } from "../lib/stats.js";

const EXAM_SIZE = 12;
const REAL_EXAM_SECONDS = 12 * 60; // דקה לשאלה — כמו מבחני הסמכה
const PASS_PCT = 70;
const REVIEW_SIZE = 15;

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

// מאגר כל השאלות, כל אחת עם מזהה יציב לחזרה המרווחת ולסטטיסטיקת המודול
function fullPool() {
  return MODULES.flatMap((m) =>
    m.quiz.map((q, i) => ({
      ...q,
      moduleId: m.id,
      qid: qid(m.id, i),
      moduleTitle: m.title,
      moduleIcon: m.icon,
    }))
  );
}

function buildQuestions(mode, { srs, mastery, today }) {
  const pool = fullPool();
  if (mode === "review") {
    return shuffle(pool.filter((q) => isDue(srs[q.qid], today)))
      .slice(0, REVIEW_SIZE)
      .map(shuffleOptions);
  }
  if (mode === "targeted") {
    const weak = new Set(weakestModules(mastery, MODULES.map((m) => m.id)));
    const weakPool = pool.filter((q) => weak.has(q.moduleId));
    return shuffle(weakPool).slice(0, EXAM_SIZE).map(shuffleOptions);
  }
  return shuffle(pool).slice(0, EXAM_SIZE).map(shuffleOptions);
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const MODE_TITLES = {
  practice: "🎓 מבחן תרגול",
  real: "⏱️ מבחן אמת",
  targeted: "🎯 תרגול ממוקד",
  review: "🗓️ חזרה יומית",
};

function ExamView({ best, srs, mastery, today, onFinish, onAnswer }) {
  const [mode, setMode] = useState(null); // null = תפריט הבחירה
  const [attempt, setAttempt] = useState(0);
  const questions = useMemo(
    () => (mode ? buildQuestions(mode, { srs, mastery, today }) : []),
    // מכוון: המאגר נבנה פעם אחת לכל כניסה למצב — עדכוני srs תוך כדי מענה
    // לא אמורים להחליף את השאלות מתחת לידיים
    [mode, attempt] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [skipped, setSkipped] = useState(0); // מבחן אמת: שאלות שלא הספיקו
  const [mistakes, setMistakes] = useState([]);
  const [timeLeft, setTimeLeft] = useState(REAL_EXAM_SECONDS);
  const deadlineRef = useRef(0);
  const counterRef = useRef(null);

  const isReal = mode === "real";
  const countsForBest = mode === "practice" || mode === "real";
  const hasAttempted = best !== null && best !== undefined;

  const dueCount = useMemo(
    () => fullPool().filter((q) => isDue(srs[q.qid], today)).length,
    [srs, today]
  );
  const weakIds = useMemo(() => weakestModules(mastery, MODULES.map((m) => m.id)), [mastery]);

  // הנגשה: בהחלפת שאלה מחזירים את הפוקוס לראש הכרטיס כדי שקוראי מסך
  // ומשתמשי מקלדת ידעו שהשאלה התחלפה.
  useEffect(() => {
    if (index > 0) counterRef.current?.focus();
  }, [index]);

  const resetRun = () => {
    setIndex(0);
    setChosen(null);
    setScore(0);
    setFinished(false);
    setSkipped(0);
    setMistakes([]);
    setTimeLeft(REAL_EXAM_SECONDS);
  };

  const start = (m) => {
    resetRun();
    if (m === "real") deadlineRef.current = Date.now() + REAL_EXAM_SECONDS * 1000;
    setAttempt((a) => a + 1);
    setMode(m);
    requestAnimationFrame(() => counterRef.current?.focus());
  };

  const backToMenu = () => {
    setMode(null);
    resetRun();
  };

  const finish = (finalScore, answered) => {
    const pct = Math.round((finalScore / questions.length) * 100);
    if (countsForBest) onFinish(pct);
    setSkipped(questions.length - answered);
    setFinished(true);
  };

  // טיימר מבחן האמת נגזר מדד-ליין אבסולוטי ולא מספירה נצברת: דפדפנים
  // מצמצמים טיימרים בטאב ברקע / מסך נעול, וספירה נצברת הייתה מקפיאה את
  // השעון — עם דד-ליין, חזרה לטאב אוכפת מיד את הזמן שחלף באמת.
  useEffect(() => {
    if (!isReal || finished || questions.length === 0) return;
    const tick = () =>
      setTimeLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
    const id = setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    tick();
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isReal, finished, questions.length]);

  // הזמן נגמר — סיום אוטומטי; מה שלא נענה נספר כטעות
  useEffect(() => {
    if (isReal && !finished && questions.length > 0 && timeLeft <= 0) finish(score, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReal, finished, timeLeft, questions.length]);

  // ---- תפריט הבחירה ----
  if (!mode) {
    const menuItems = [
      {
        id: "practice",
        icon: "🎓",
        title: "מבחן תרגול",
        desc: `${EXAM_SIZE} שאלות אקראיות עם הסבר מיד אחרי כל תשובה.`,
        enabled: true,
      },
      {
        id: "real",
        icon: "⏱️",
        title: "מבחן אמת",
        desc: `${EXAM_SIZE} שאלות, ${Math.round(REAL_EXAM_SECONDS / 60)} דקות, בלי משוב באמצע. עוברים ב-${PASS_PCT}%.`,
        enabled: true,
      },
      {
        id: "targeted",
        icon: "🎯",
        title: "תרגול ממוקד",
        desc: weakIds.length
          ? `שאלות מהמודולים החלשים שלך: ${weakIds
              .map((id) => MODULES.find((m) => m.id === id)?.title.split(" — ")[0])
              .join(", ")}`
          : "ייפתח אחרי שתענו על מספיק שאלות — נזהה יחד את הנקודות החלשות.",
        enabled: weakIds.length > 0,
      },
      {
        id: "review",
        icon: "🗓️",
        title: "חזרה יומית",
        desc:
          dueCount > 0
            ? `${dueCount} שאלות מחכות לחזרה. שיטת הקופסאות: מה שטעיתם בו חוזר מהר, מה שיודעים — מתרווח.`
            : "אין שאלות לחזרה כרגע — כל תשובה בחידונים ובמבחנים נכנסת למחזור. חזרו מחר!",
        enabled: dueCount > 0,
      },
    ];
    return (
      <div className="space-y-4">
        <header className="bg-ink text-white rounded-2xl p-6">
          <h1 className="font-bold text-2xl mb-1">🎓 תרגול ומבחנים</h1>
          <p className="text-white/90">
            מאגר של {TOTAL_QUIZ_QUESTIONS} שאלות מכל המודולים.
            {hasAttempted && <span className="font-mono"> שיא אישי: {best}%</span>}
          </p>
        </header>
        <div className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.enabled && start(item.id)}
              disabled={!item.enabled}
              className={`w-full text-right rounded-2xl p-5 transition shadow-sm ${
                item.enabled ? "bg-white hover:shadow-md" : "bg-white/60 opacity-70"
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl shrink-0" aria-hidden>{item.icon}</span>
                <div>
                  <p className="font-bold">{item.title}</p>
                  <p className="text-sm text-ink/70 leading-relaxed mt-0.5">{item.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // מקרה קצה: נכנסו למצב בלי שאלות (למשל חזרה שהתרוקנה) — חזרה לתפריט
  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-4">
        <p>אין שאלות זמינות במצב הזה כרגע.</p>
        <button onClick={backToMenu} className="bg-magic text-white rounded-2xl px-8 py-3 font-bold">
          חזרה לתפריט
        </button>
      </div>
    );
  }

  // ---- מסך תוצאות ----
  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= PASS_PCT;
    const msg =
      mode === "review"
        ? "החזרה היומית הושלמה — השאלות שטעיתם בהן יחזרו מחר, השאר התרווחו קדימה."
        : pct >= 90
        ? "מצוין! רמת שליטה של מפקח בכיר 💪"
        : passed
        ? "יפה מאוד! עוד סבב קצר על המודולים החלשים — והציון המלא בהישג יד."
        : "התחלה טובה — כדאי לחזור למודולים ולגשת שוב למבחן. הידע הזה שווה טופס 4 בזמן.";
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-4">
        <div className="text-6xl" aria-hidden>
          {mode === "review" ? "🗓️" : passed ? "🏆" : "📚"}
        </div>
        <h1 className="font-bold text-2xl">
          {score} מתוך {questions.length} ({pct}%)
        </h1>
        {isReal && (
          <p
            className={`font-bold text-lg rounded-xl py-2 ${
              passed ? "bg-grow/15 text-growdeep" : "bg-red-50 text-red-700"
            }`}
          >
            {passed ? `✔️ עובר (${PASS_PCT}%+)` : `✖️ מתחת לרף המעבר (${PASS_PCT}%)`}
          </p>
        )}
        {skipped > 0 && (
          <p className="text-sm text-ink/70">⏱️ הזמן נגמר — {skipped} שאלות לא נענו ונספרו כטעות.</p>
        )}
        <p className="text-ink/80">{msg}</p>
        {hasAttempted && countsForBest && (
          <p className="text-sm font-mono text-magic">שיא אישי: {best}%</p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => start(mode)}
            className="bg-magic text-white rounded-2xl px-8 py-3 font-bold hover:opacity-90"
          >
            {mode === "review" ? "עוד סבב" : "מבחן חדש"}
          </button>
          <button
            onClick={backToMenu}
            className="border border-ink/15 rounded-2xl px-8 py-3 font-bold hover:border-magic"
          >
            לתפריט המבחנים
          </button>
        </div>

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
              💡 טיפ: השאלות האלה ייכנסו לחזרה היומית — וגם מחכות לכם במודולים שלהן.
            </p>
          </section>
        )}
      </div>
    );
  }

  // ---- מהלך המבחן ----
  const q = questions[index];
  const answered = chosen !== null;

  const advance = (curScore, curIndex) => {
    if (curIndex + 1 >= questions.length) {
      finish(curScore, questions.length);
    } else {
      setIndex(curIndex + 1);
      setChosen(null);
    }
  };

  const choose = (i) => {
    if (answered) return;
    const correct = i === q.answer;
    onAnswer(q.moduleId, q.qid, correct);
    const newScore = correct ? score + 1 : score;
    if (correct) setScore(newScore);
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
    if (isReal) {
      // מבחן אמת: בלי חשיפת התשובה — ממשיכים ישר לשאלה הבאה
      advance(newScore, index);
    } else {
      setChosen(i);
    }
  };

  return (
    <div className="space-y-4">
      <header className="bg-ink text-white rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-bold text-2xl">{MODE_TITLES[mode]}</h1>
          {isReal && (
            <span
              className={`font-mono text-xl font-bold rounded-xl px-3 py-1 ${
                timeLeft <= 60 ? "bg-red-500/90" : "bg-white/15"
              }`}
              role="timer"
              aria-label={`זמן שנותר: ${fmtTime(timeLeft)}`}
            >
              {fmtTime(timeLeft)}
            </span>
          )}
        </div>
        <p className="text-white/90 mt-1">
          {mode === "review"
            ? "משוב מיד אחרי כל תשובה — טעות מחזירה את השאלה למחר."
            : isReal
            ? `בלי משוב באמצע — התוצאה המלאה בסוף. מעבר: ${PASS_PCT}%.`
            : `${questions.length} שאלות אקראיות מתוך מאגר של ${TOTAL_QUIZ_QUESTIONS} שאלות.`}
          {hasAttempted && countsForBest && <span className="font-mono"> שיא אישי: {best}%</span>}
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
                onClick={() => choose(i)}
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
            onClick={() => advance(score, index)}
            className="mt-4 w-full bg-magic text-white rounded-2xl py-3 font-bold hover:opacity-90"
          >
            {index + 1 >= questions.length ? "סיום" : "לשאלה הבאה"}
          </button>
        )}

        <button
          onClick={backToMenu}
          className="mt-3 w-full text-center text-ink/60 text-sm font-semibold hover:text-ink"
        >
          ← יציאה לתפריט המבחנים (ההתקדמות בסבב הזה לא תישמר)
        </button>
      </div>
    </div>
  );
}

// הרכיב חי תמיד ברקע (נשמר בין טאבים) — memo מונע רינדור מחדש שלו על כל
// שינוי state לא-קשור ב-App; ה-props פונקציות יציבות (useCallback) ואובייקטים
// שמשתנים רק כשבאמת יש עדכון.
export default memo(ExamView);
