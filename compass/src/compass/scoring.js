// מצפן — scoring for the assessment instruments. Pure functions over the
// answers object shape produced by useJourney: { riasec: {itemId: 1..5}, ... }.

import {
  RIASEC_ITEMS, RIASEC_TYPES, BIG5_ITEMS, BIG5_TRAITS,
  VALUES_ITEMS, COGNITIVE_ITEMS, COGNITIVE_ADVANCED, COGNITIVE_DOMAINS, OPEN_QUESTIONS,
} from "./data/questions";

// RIASEC: sum per type (5 items × 1–5 → 5..25), plus a sorted 3-letter code.
export function scoreRiasec(answers = {}) {
  const sums = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  for (const item of RIASEC_ITEMS) sums[item.type] += answers[item.id] || 0;
  const sorted = Object.entries(sums).sort((a, b) => b[1] - a[1]);
  return {
    scores: sums,
    code: sorted.slice(0, 3).map(([t]) => t).join(""),
    top: sorted.slice(0, 3).map(([t, s]) => ({ type: t, label: RIASEC_TYPES[t], score: s })),
  };
}

// Big Five: average per trait on a 1–5 scale, reversed items flipped.
export function scoreBig5(answers = {}) {
  const acc = {};
  for (const item of BIG5_ITEMS) {
    const raw = answers[item.id];
    if (!raw) continue;
    const v = item.reversed ? 6 - raw : raw;
    (acc[item.trait] ??= []).push(v);
  }
  const traits = {};
  for (const [t, vals] of Object.entries(acc)) {
    traits[t] = {
      label: BIG5_TRAITS[t],
      score: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
    };
  }
  return traits;
}

// Values: sorted list, highest-rated first.
export function scoreValues(answers = {}) {
  return VALUES_ITEMS
    .map((v) => ({ id: v.id, label: v.text, score: answers[v.id] || 0 }))
    .sort((a, b) => b.score - a.score);
}

// Cognitive: correct counts per domain + total. The adaptive bonus round is
// scored separately — answered only by users who cleared the base threshold.
export function scoreCognitive(answers = {}) {
  const domains = {};
  let total = 0;
  for (const item of COGNITIVE_ITEMS) {
    const d = (domains[item.domain] ??= { label: COGNITIVE_DOMAINS[item.domain], correct: 0, of: 0 });
    d.of += 1;
    if (answers[item.id] === item.correct) { d.correct += 1; total += 1; }
  }
  let advCorrect = 0, advAnswered = 0;
  for (const item of COGNITIVE_ADVANCED) {
    if (answers[item.id] === undefined) continue;
    advAnswered += 1;
    if (answers[item.id] === item.correct) advCorrect += 1;
  }
  return { domains, total, of: COGNITIVE_ITEMS.length, advCorrect, advAnswered };
}

// The compact profile object sent to the AI agents. Everything the model needs,
// with question texts resolved (the server never sees our item ids).
export function buildProfile(answers = {}) {
  const riasec = scoreRiasec(answers.riasec);
  const big5 = scoreBig5(answers.bigfive);
  const values = scoreValues(answers.values);
  const cognitive = scoreCognitive(answers.cognitive);
  return {
    background: answers.background || {},
    riasec: {
      code: riasec.code,
      top: riasec.top,
      scores: riasec.scores,
    },
    big5,
    values: {
      top: values.slice(0, 4).filter((v) => v.score >= 4),
      low: values.slice(-3).filter((v) => v.score <= 2),
      all: values,
    },
    cognitive: {
      total: `${cognitive.total}/${cognitive.of}`,
      domains: [
        ...Object.values(cognitive.domains).map((d) => `${d.label}: ${d.correct}/${d.of}`),
        // The bonus-round signal rides in the domains list (the server prompt
        // already prints it) — strong differentiator for top-end candidates.
        cognitive.advAnswered > 0
          ? `שלב בונוס מתקדם (נפתח רק למצטיינים): ${cognitive.advCorrect}/${cognitive.advAnswered}`
          : "שלב הבונוס המתקדם לא נפתח (מתחת לסף בשלב הבסיס)",
      ],
    },
    openAnswers: OPEN_QUESTIONS.map((q) => ({
      question: q.text,
      answer: (answers.open || {})[q.id] || "",
    })).filter((qa) => qa.answer.trim()),
  };
}
