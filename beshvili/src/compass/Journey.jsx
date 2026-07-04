import { useEffect, useState } from "react";
import {
  STAGE_INTROS, STAGES,
  RIASEC_ITEMS, VALUES_ITEMS, BIG5_ITEMS, COGNITIVE_ITEMS, OPEN_QUESTIONS,
  INTEREST_SCALE, AGREE_SCALE, VALUE_SCALE,
  SITUATION_OPTIONS, EDUCATION_OPTIONS, CONSTRAINT_OPTIONS,
} from "./data/questions";
import { Btn, Chip, Scale, StageIntro } from "./ui";

// מצפן — the assessment stages. Each stage: intro screen → items → save + advance.
// All answers are saved to the journey continuously (a screen refresh or a
// multi-day pause never loses progress).

const stageMeta = (id) => STAGES.find((s) => s.id === id) ?? {};

function ItemCounter({ index, total }) {
  return (
    <div className="text-xs text-white/35 mb-4 tracking-wide">
      {index + 1} / {total}
    </div>
  );
}

function BackNext({ onBack, onNext, nextDisabled, nextLabel = "הבא ←" }) {
  return (
    <div className="flex items-center justify-between mt-8">
      <button onClick={onBack} className="text-sm text-white/40 hover:text-white/70 transition-colors px-2 py-2">
        → חזרה
      </button>
      <Btn onClick={onNext} disabled={nextDisabled}>{nextLabel}</Btn>
    </div>
  );
}

// ── Generic one-item-at-a-time likert runner (riasec / values / bigfive) ──
function LikertStage({ stageId, items, scale, prompt, saved, onDone, onSave }) {
  const intro = STAGE_INTROS[stageId];
  const meta = stageMeta(stageId);
  const [started, setStarted] = useState(() => Object.keys(saved || {}).length > 0);
  const [answers, setAnswers] = useState(saved || {});
  const firstUnanswered = items.findIndex((it) => !answers[it.id]);
  const [idx, setIdx] = useState(firstUnanswered < 0 ? 0 : firstUnanswered);

  if (!started) {
    return <StageIntro icon={meta.icon} title={intro.title} text={intro.text} minutes={meta.minutes} onStart={() => setStarted(true)} />;
  }

  const item = items[idx];
  const pick = (v) => {
    const next = { ...answers, [item.id]: v };
    setAnswers(next);
    onSave(next);
    // Auto-advance keeps the flow fast; a short beat lets the selection register visually.
    setTimeout(() => {
      if (idx < items.length - 1) setIdx(idx + 1);
      else onDone(next);
    }, 220);
  };

  return (
    <div className="flex-1 flex flex-col justify-center animate-[fadeIn_0.3s_ease]" key={item.id}>
      <ItemCounter index={idx} total={items.length} />
      {prompt && <p className="text-sm text-white/45 mb-2">{prompt}</p>}
      <h3 className="text-2xl font-bold leading-snug mb-8 min-h-[4rem]">{item.text}</h3>
      <Scale value={answers[item.id]} onSelect={pick} labels={scale} />
      <div className="mt-8">
        {idx > 0 && (
          <button onClick={() => setIdx(idx - 1)} className="text-sm text-white/40 hover:text-white/70 transition-colors">
            → לשאלה הקודמת
          </button>
        )}
      </div>
    </div>
  );
}

// ── Background form ──
function BackgroundStage({ saved, onDone, onSave }) {
  const intro = STAGE_INTROS.background;
  const meta = stageMeta("background");
  const [started, setStarted] = useState(() => !!saved?.name);
  const [form, setForm] = useState(saved || { name: "", age: "", situation: "", education: [], constraints: [], freeText: "" });

  const set = (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    onSave(next);
  };
  const toggle = (key, val) =>
    set({ [key]: form[key].includes(val) ? form[key].filter((v) => v !== val) : [...form[key], val] });

  if (!started) {
    return <StageIntro icon={meta.icon} title={intro.title} text={intro.text} minutes={meta.minutes} onStart={() => setStarted(true)} />;
  }

  const valid = form.name.trim() && form.age && form.situation;
  return (
    <div className="flex-1 py-2 animate-[fadeIn_0.3s_ease] space-y-7">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-white/55 mb-2">איך קוראים לך?</label>
          <input
            value={form.name}
            onChange={(e) => set({ name: e.target.value.slice(0, 40) })}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-magic transition-colors"
            placeholder="שם או כינוי"
          />
        </div>
        <div>
          <label className="block text-sm text-white/55 mb-2">בן כמה אתה?</label>
          <input
            value={form.age}
            onChange={(e) => set({ age: e.target.value.replace(/\D/g, "").slice(0, 2) })}
            inputMode="numeric"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-magic transition-colors"
            placeholder="למשל 22"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/55 mb-2">איפה אתה נמצא עכשיו בחיים?</label>
        <div className="flex flex-wrap gap-2">
          {SITUATION_OPTIONS.map((o) => (
            <Chip key={o} selected={form.situation === o} onClick={() => set({ situation: o })}>{o}</Chip>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/55 mb-2">מה יש לך ביד? (אפשר כמה)</label>
        <div className="flex flex-wrap gap-2">
          {EDUCATION_OPTIONS.map((o) => (
            <Chip key={o} selected={form.education.includes(o)} onClick={() => toggle("education", o)}>{o}</Chip>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/55 mb-2">יש אילוצים שחשוב שנכיר?</label>
        <div className="flex flex-wrap gap-2">
          {CONSTRAINT_OPTIONS.map((o) => (
            <Chip key={o} selected={form.constraints.includes(o)} onClick={() => toggle("constraints", o)}>{o}</Chip>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/55 mb-2">
          ספר קצת על עצמך — מה עשית עד היום, ואיפה אתה מרגיש תקוע?
        </label>
        <textarea
          value={form.freeText}
          onChange={(e) => set({ freeText: e.target.value.slice(0, 1500) })}
          rows={4}
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-magic transition-colors leading-relaxed"
          placeholder="בחופשיות, כמה משפטים…"
        />
      </div>

      <div className="flex justify-end">
        <Btn onClick={() => onDone(form)} disabled={!valid}>ממשיכים ←</Btn>
      </div>
    </div>
  );
}

// ── Cognitive multiple-choice ──
function CognitiveStage({ saved, onDone, onSave }) {
  const intro = STAGE_INTROS.cognitive;
  const meta = stageMeta("cognitive");
  const [started, setStarted] = useState(() => Object.keys(saved || {}).length > 0);
  const [answers, setAnswers] = useState(saved || {});
  const firstUnanswered = COGNITIVE_ITEMS.findIndex((it) => answers[it.id] === undefined);
  const [idx, setIdx] = useState(firstUnanswered < 0 ? 0 : firstUnanswered);

  if (!started) {
    return <StageIntro icon={meta.icon} title={intro.title} text={intro.text} minutes={meta.minutes} onStart={() => setStarted(true)} />;
  }

  const item = COGNITIVE_ITEMS[idx];
  const pick = (optIdx) => {
    const next = { ...answers, [item.id]: optIdx };
    setAnswers(next);
    onSave(next);
    setTimeout(() => {
      if (idx < COGNITIVE_ITEMS.length - 1) setIdx(idx + 1);
      else onDone(next);
    }, 250);
  };

  return (
    <div className="flex-1 flex flex-col justify-center animate-[fadeIn_0.3s_ease]" key={item.id}>
      <ItemCounter index={idx} total={COGNITIVE_ITEMS.length} />
      <h3 className="text-2xl font-bold leading-snug mb-8">{item.text}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {item.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            className={`rounded-2xl border px-5 py-4 text-right font-medium transition-all ${
              answers[item.id] === i
                ? "bg-magic/25 border-magic text-white"
                : "bg-white/5 border-white/15 text-white/75 hover:border-magic/50 hover:bg-magic/10"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Open reflective questions ──
function OpenStage({ saved, onDone, onSave }) {
  const intro = STAGE_INTROS.open;
  const meta = stageMeta("open");
  const [started, setStarted] = useState(() => Object.keys(saved || {}).length > 0);
  const [answers, setAnswers] = useState(saved || {});
  const [idx, setIdx] = useState(0);

  // Focus is expensive on mobile keyboards — only reset scroll between questions.
  useEffect(() => { window.scrollTo(0, 0); }, [idx]);

  if (!started) {
    return <StageIntro icon={meta.icon} title={intro.title} text={intro.text} minutes={meta.minutes} onStart={() => setStarted(true)} />;
  }

  const q = OPEN_QUESTIONS[idx];
  const val = answers[q.id] || "";
  const setVal = (v) => {
    const next = { ...answers, [q.id]: v.slice(0, 2000) };
    setAnswers(next);
    onSave(next);
  };
  const canNext = val.trim().length >= 20;

  return (
    <div className="flex-1 flex flex-col justify-center animate-[fadeIn_0.3s_ease]" key={q.id}>
      <ItemCounter index={idx} total={OPEN_QUESTIONS.length} />
      <h3 className="text-2xl font-bold leading-snug mb-2">{q.text}</h3>
      <p className="text-sm text-white/40 mb-6">{q.hint}</p>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        rows={6}
        className="w-full bg-white/5 border border-white/15 rounded-2xl px-4 py-3 outline-none focus:border-magic transition-colors leading-relaxed"
        placeholder="כתוב בחופשיות…"
      />
      {!canNext && val.trim().length > 0 && (
        <p className="text-xs text-white/30 mt-2">עוד קצת… תן לפחות משפט או שניים 🙏</p>
      )}
      <BackNext
        onBack={() => (idx > 0 ? setIdx(idx - 1) : setStarted(false))}
        onNext={() => (idx < OPEN_QUESTIONS.length - 1 ? setIdx(idx + 1) : onDone(answers))}
        nextDisabled={!canNext}
        nextLabel={idx < OPEN_QUESTIONS.length - 1 ? "הבא ←" : "סיימתי ←"}
      />
    </div>
  );
}

// ── Stage router ──
export default function Journey({ journey, saveSection, nextStage }) {
  const { stage, answers } = journey;
  const done = (key) => (data) => { saveSection(key, data); nextStage(); };
  const save = (key) => (data) => saveSection(key, data);

  switch (stage) {
    case "background":
      return <BackgroundStage saved={answers.background} onDone={done("background")} onSave={save("background")} />;
    case "riasec":
      return (
        <LikertStage
          stageId="riasec" items={RIASEC_ITEMS} scale={INTEREST_SCALE}
          prompt="עד כמה היית נהנה…" saved={answers.riasec}
          onDone={done("riasec")} onSave={save("riasec")}
        />
      );
    case "values":
      return (
        <LikertStage
          stageId="values" items={VALUES_ITEMS} scale={VALUE_SCALE}
          prompt="עד כמה זה חשוב לך…" saved={answers.values}
          onDone={done("values")} onSave={save("values")}
        />
      );
    case "bigfive":
      return (
        <LikertStage
          stageId="bigfive" items={BIG5_ITEMS} scale={AGREE_SCALE}
          prompt="עד כמה זה מתאר אותך…" saved={answers.bigfive}
          onDone={done("bigfive")} onSave={save("bigfive")}
        />
      );
    case "cognitive":
      return <CognitiveStage saved={answers.cognitive} onDone={done("cognitive")} onSave={save("cognitive")} />;
    case "open":
      return <OpenStage saved={answers.open} onDone={done("open")} onSave={save("open")} />;
    default:
      return null;
  }
}
