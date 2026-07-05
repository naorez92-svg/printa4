import { useEffect, useState } from "react";
import {
  STAGE_INTROS, STAGES,
  RIASEC_ITEMS, VALUES_ITEMS, BIG5_ITEMS, COGNITIVE_ITEMS, OPEN_QUESTIONS,
  COGNITIVE_ADVANCED, COGNITIVE_ADVANCED_THRESHOLD,
  INTEREST_SCALE, AGREE_SCALE, VALUE_SCALE, SCENARIO_SCALE,
  SITUATION_OPTIONS, EDUCATION_OPTIONS, CONSTRAINT_OPTIONS,
} from "./data/questions";
import { scenarioItems } from "./scoring";
import { Btn, Chip, Scale, StageIntro, MicButton, DictationTip } from "./ui";

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

  // Defensive clamp: even if idx ever escapes the list bounds, render the
  // last item instead of crashing the whole app to a white screen.
  const item = items[Math.min(idx, items.length - 1)];
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

      {/* The current occupation is the single most important anchor for a
          working adult — a real user's report suggested "stay in your role,
          go managerial" without knowing the role, because we never asked. */}
      <div>
        <label className="block text-sm text-white/55 mb-2">
          במה אתה עוסק היום בפועל? (תפקיד, תחום, כמה זמן)
        </label>
        <input
          value={form.currentRole || ""}
          onChange={(e) => set({ currentRole: e.target.value.slice(0, 120) })}
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-magic transition-colors"
          placeholder="למשל: מורה בתיכון, 6 שנים · מלצר · חייל לפני שחרור"
        />
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
          placeholder="בחופשיות, כמה משפטים… או לחץ 🎤 ודבר"
        />
        <div className="mt-2">
          <MicButton onText={(t) => setForm((prev) => {
            const next = { ...prev, freeText: `${prev.freeText} ${t}`.trim().slice(0, 1500) };
            onSave(next);
            return next;
          })} />
        </div>
      </div>

      <div className="flex justify-end">
        <Btn onClick={() => onDone(form)} disabled={!valid}>ממשיכים ←</Btn>
      </div>
    </div>
  );
}

// ── Cognitive multiple-choice — adaptive two-phase ──
// Everyone gets the 8 base items. Scoring ≥ threshold unlocks a bonus round
// of 6 harder items (top-end discrimination without tiring everyone else).
function CognitiveStage({ saved, onDone, onSave }) {
  const intro = STAGE_INTROS.cognitive;
  const meta = stageMeta("cognitive");
  const [started, setStarted] = useState(() => Object.keys(saved || {}).length > 0);
  const [answers, setAnswers] = useState(saved || {});
  const [bonusIntro, setBonusIntro] = useState(false);
  // The active round is EXPLICIT state (not derived from answers) so the item
  // list never flips mid-render: after the last base answer, items stay on the
  // base list through the 250ms beat — a double-tap re-records the same base
  // item instead of leaking an accidental answer into (or past) the bonus round.
  const [phase, setPhase] = useState(() => {
    const a = saved || {};
    const baseAll = COGNITIVE_ITEMS.every((it) => a[it.id] !== undefined);
    const correct = COGNITIVE_ITEMS.filter((it) => a[it.id] === it.correct).length;
    const advStarted = COGNITIVE_ADVANCED.some((it) => a[it.id] !== undefined);
    return baseAll && correct >= COGNITIVE_ADVANCED_THRESHOLD && advStarted ? "bonus" : "base";
  });

  const baseCorrect = COGNITIVE_ITEMS.filter((it) => answers[it.id] === it.correct).length;
  const items = phase === "bonus" ? COGNITIVE_ADVANCED : COGNITIVE_ITEMS;
  const firstUnanswered = items.findIndex((it) => answers[it.id] === undefined);
  const [idx, setIdx] = useState(firstUnanswered < 0 ? 0 : firstUnanswered);

  // Resume reconciliation: a refresh in the 250ms beat after the final answer
  // lands back here with everything answered. Route forward instead of making
  // the user re-click through answered items.
  useEffect(() => {
    if (!started) return;
    const a = answers;
    if (!COGNITIVE_ITEMS.every((it) => a[it.id] !== undefined)) return;
    const correct = COGNITIVE_ITEMS.filter((it) => a[it.id] === it.correct).length;
    if (correct < COGNITIVE_ADVANCED_THRESHOLD) { onDone(a); return; }
    if (COGNITIVE_ADVANCED.every((it) => a[it.id] !== undefined)) { onDone(a); return; }
    if (phase === "base") setBonusIntro(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (!started) {
    return <StageIntro icon={meta.icon} title={intro.title} text={intro.text} minutes={meta.minutes} onStart={() => setStarted(true)} />;
  }

  // Interstitial before the bonus round — earned, not imposed.
  if (bonusIntro) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center animate-[fadeIn_0.4s_ease]">
        <div className="text-6xl mb-5">🔥</div>
        <h2 className="text-3xl font-bold font-display mb-3">פיצחת את הבסיס!</h2>
        <p className="text-white/60 leading-relaxed max-w-md mb-2">
          {baseCorrect}/{COGNITIVE_ITEMS.length} נכונות — אתה בקצה העליון. פתחנו לך
          שלב בונוס של {COGNITIVE_ADVANCED.length} חידות ברמה גבוהה באמת, כדי שהדוח
          ידע בדיוק עד לאן החשיבה שלך מגיעה.
        </p>
        <p className="text-xs text-white/35 mb-8">~3 דקות · גם טעויות כאן זה מידע מצוין</p>
        <Btn onClick={() => { setBonusIntro(false); setPhase("bonus"); setIdx(0); }} className="min-w-[200px]">קדימה 🔥</Btn>
      </div>
    );
  }

  const item = items[Math.min(idx, items.length - 1)];
  const pick = (optIdx) => {
    const next = { ...answers, [item.id]: optIdx };
    setAnswers(next);
    onSave(next);
    setTimeout(() => {
      if (idx < items.length - 1) { setIdx(idx + 1); return; }
      if (phase === "base") {
        // Base round just finished — unlock the bonus for strong scorers.
        const correct = COGNITIVE_ITEMS.filter((it) => next[it.id] === it.correct).length;
        if (correct >= COGNITIVE_ADVANCED_THRESHOLD) { setBonusIntro(true); return; }
      }
      onDone(next);
    }, 250);
  };

  return (
    <div className="flex-1 flex flex-col justify-center animate-[fadeIn_0.3s_ease]" key={item.id}>
      <div className="flex items-center gap-2">
        <ItemCounter index={idx} total={items.length} />
        {phase === "bonus" && <span className="text-xs text-brand font-bold mb-4">🔥 שלב בונוס</span>}
      </div>
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
  // Dictation chunks append via a FUNCTIONAL update — several utterances in
  // one recording session must not clobber each other.
  const appendDictation = (t) => {
    setAnswers((prev) => {
      const cur = prev[q.id] || "";
      const next = { ...prev, [q.id]: `${cur} ${t}`.trim().slice(0, 2000) };
      onSave(next);
      return next;
    });
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
        placeholder="כתוב בחופשיות… או לחץ 🎤 ודבר"
      />
      <div className="flex items-center justify-between gap-2 mt-2">
        <MicButton key={q.id} onText={appendDictation} />
        {!canNext && val.trim().length > 0 && (
          <p className="text-xs text-white/30">עוד קצת… תן לפחות משפט או שניים 🙏</p>
        )}
      </div>
      <DictationTip />
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
    // key={stage} forces a REMOUNT between likert stages. Without it React
    // reuses the same LikertStage instance across riasec→values, keeping the
    // old idx (29) against the new 12-item list → items[29] is undefined →
    // white-screen crash (recovered only by a refresh).
    case "riasec":
      return (
        <LikertStage
          key="riasec"
          stageId="riasec" items={RIASEC_ITEMS} scale={INTEREST_SCALE}
          prompt="עד כמה היית נהנה…" saved={answers.riasec}
          onDone={done("riasec")} onSave={save("riasec")}
        />
      );
    case "values":
      return (
        <LikertStage
          key="values"
          stageId="values" items={VALUES_ITEMS} scale={VALUE_SCALE}
          prompt="עד כמה זה חשוב לך…" saved={answers.values}
          onDone={done("values")} onSave={save("values")}
        />
      );
    case "bigfive":
      return (
        <LikertStage
          key="bigfive"
          stageId="bigfive" items={BIG5_ITEMS} scale={AGREE_SCALE}
          prompt="עד כמה זה מתאר אותך…" saved={answers.bigfive}
          onDone={done("bigfive")} onSave={save("bigfive")}
        />
      );
    case "cognitive":
      return <CognitiveStage saved={answers.cognitive} onDone={done("cognitive")} onSave={save("cognitive")} />;
    case "open":
      return <OpenStage saved={answers.open} onDone={done("open")} onSave={save("open")} />;
    // "Reality check" — the item list itself is personalized: 6 day-in-the-life
    // scenarios chosen from THIS user's top-3 Holland letters.
    case "scenarios":
      return (
        <LikertStage
          key="scenarios"
          stageId="scenarios" items={scenarioItems(answers.riasec)} scale={SCENARIO_SCALE}
          prompt="דמיין שזה היום-יום שלך בעוד שנתיים…" saved={answers.scenarios}
          onDone={done("scenarios")} onSave={save("scenarios")}
        />
      );
    default:
      return null;
  }
}
