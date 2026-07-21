import { useState } from "react";

function Section({ icon, title, children }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
        <span aria-hidden>{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function QuizQuestion({ index, item, chosen, onChoose }) {
  const answered = chosen !== undefined;
  return (
    <div className="border border-ink/10 rounded-xl p-4">
      <p className="font-semibold mb-3">
        {index + 1}. {item.q}
      </p>
      <div className="grid gap-2">
        {item.options.map((opt, i) => {
          let cls = "bg-canvas hover:bg-magic/10 border-transparent";
          if (answered) {
            if (i === item.answer) cls = "bg-grow/15 border-grow text-ink";
            else if (i === chosen) cls = "bg-red-100 border-red-400";
            else cls = "bg-canvas opacity-60 border-transparent";
          }
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => onChoose(i)}
              className={`text-right rounded-lg border px-3 py-2 transition ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <p className={`mt-3 text-sm rounded-lg p-3 ${chosen === item.answer ? "bg-grow/10" : "bg-brand/10"}`}>
          {chosen === item.answer ? "✔️ נכון! " : "✖️ לא מדויק. "}
          {item.explain}
        </p>
      )}
    </div>
  );
}

export default function ModuleView({ module, done, onToggleDone, onBack }) {
  const [answers, setAnswers] = useState({});

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-magic font-semibold hover:underline">
        → חזרה לכל המודולים
      </button>

      <header className="bg-ink text-white rounded-2xl p-6">
        <div className="text-4xl mb-2" aria-hidden>{module.icon}</div>
        <h2 className="font-bold text-2xl mb-2">{module.title}</h2>
        <p className="text-white/85 leading-relaxed">{module.summary}</p>
      </header>

      <Section icon="🎯" title="נקודות המפתח">
        <ul className="space-y-2">
          {module.points.map((p, i) => (
            <li key={i} className="flex gap-2 leading-relaxed">
              <span className="text-grow font-bold shrink-0">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon="📖" title="תקנים ורגולציה">
        <ul className="space-y-2">
          {module.standards.map((s, i) => (
            <li key={i} className="bg-canvas rounded-lg px-3 py-2 text-sm leading-relaxed">
              {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon="⚠️" title="ליקויים נפוצים בשטח">
        <ul className="space-y-2">
          {module.pitfalls.map((p, i) => (
            <li key={i} className="flex gap-2 leading-relaxed text-sm">
              <span className="text-brand font-bold shrink-0">!</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon="✍️" title="תרגול">
        <div className="space-y-4">
          {module.quiz.map((item, i) => (
            <QuizQuestion
              key={i}
              index={i}
              item={item}
              chosen={answers[i]}
              onChoose={(choice) => setAnswers((a) => ({ ...a, [i]: choice }))}
            />
          ))}
        </div>
      </Section>

      <button
        onClick={onToggleDone}
        className={`w-full rounded-2xl py-4 font-bold text-lg transition ${
          done ? "bg-grow text-white" : "bg-magic text-white hover:opacity-90"
        }`}
      >
        {done ? "✔️ המודול הושלם — לחיצה לביטול" : "סיימתי את המודול"}
      </button>
    </div>
  );
}
