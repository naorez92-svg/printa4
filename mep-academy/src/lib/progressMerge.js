// מיזוג מצב למידה בין מכשיר לענן.
//
// הבעיה שפתרנו: מיזוג "מקומי גובר" ({...remote, ...local}) נתן לערך מקומי ישן
// לדרוס השלמה עדכנית ממכשיר אחר — ודחיפת הסנפשוט המלא קיבעה את הדריסה בענן.
// הפתרון: לכל סימון (מודול שהושלם / סעיף טופס 4) נשמרת חותמת זמן, והמיזוג
// בוחר פר-מפתח את הכתיבה המאוחרת. כך ביטול נשאר אפשרי, ושום צד לא מוחק
// התקדמות של הצד השני בטעות.
//
// תאימות לאחור: בענן קיימים נתונים בפורמט הישן (בוליאני חשוף). הם מנורמלים
// ל-{v, t:0} — כל כתיבה חדשה גוברת עליהם, ובתיקו (שני צדדים ישנים) עדיפות
// לערך החיובי כדי לא לאבד התקדמות.

// {id: true|false|{v,t}} → {id: {v, t}}; ערכי שקר ישנים נזרקים (שקולים להיעדר)
function normMarkMap(map = {}) {
  const out = {};
  for (const [k, raw] of Object.entries(map)) {
    if (typeof raw === "boolean") {
      if (raw) out[k] = { v: true, t: 0 };
    } else if (raw && typeof raw.v === "boolean") {
      out[k] = { v: raw.v, t: Number.isFinite(raw.t) ? raw.t : 0 };
    }
  }
  return out;
}

function mergeMarkMap(a = {}, b = {}) {
  const na = normMarkMap(a);
  const nb = normMarkMap(b);
  const out = { ...na };
  for (const [k, v] of Object.entries(nb)) {
    const cur = out[k];
    if (!cur || v.t > cur.t || (v.t === cur.t && v.v && !cur.v)) out[k] = v;
  }
  return out;
}

// תצוגה לרכיבי ה-UI: מפה בוליאנית פשוטה של מה שמסומן כרגע
export function boolView(markMap = {}) {
  const out = {};
  for (const [k, e] of Object.entries(normMarkMap(markMap))) if (e.v) out[k] = true;
  return out;
}

export function setMark(markMap, id, value, now = Date.now()) {
  return { ...normMarkMap(markMap), [id]: { v: value, t: now } };
}

// חזרה מרווחת: לכל שאלה מנצחת הרשומה שנענתה מאוחר יותר (חותמת t)
function mergeSrs(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!out[k] || (v?.t || 0) > (out[k]?.t || 0)) out[k] = v;
  }
  return out;
}

// שליטה פר-מודול: מקסימום לכל מונה — מונוטוני וחסין למיזוגים חוזרים
// (סכימה הייתה סופרת כפול כשאותה התקדמות ממוזגת פעמיים)
function mergeMastery(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    out[k] = cur
      ? { c: Math.max(cur.c || 0, v?.c || 0), w: Math.max(cur.w || 0, v?.w || 0) }
      : v;
  }
  return out;
}

// רצף: מנצח מי שפעיל לאחרונה; באותו יום — הרצף הארוך
function mergeStreak(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  if (a.last !== b.last) return a.last > b.last ? a : b;
  return (a.n || 0) >= (b.n || 0) ? a : b;
}

export function mergeProgress(remote = {}, local = {}) {
  const bestExam = Math.max(
    Number.isFinite(remote.bestExam) ? remote.bestExam : -1,
    Number.isFinite(local.bestExam) ? local.bestExam : -1
  );
  return {
    completed: mergeMarkMap(remote.completed, local.completed),
    tofes4: mergeMarkMap(remote.tofes4, local.tofes4),
    bestExam: bestExam >= 0 ? bestExam : null,
    srs: mergeSrs(remote.srs, local.srs),
    mastery: mergeMastery(remote.mastery, local.mastery),
    streak: mergeStreak(remote.streak, local.streak),
  };
}

export function sameProgress(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
