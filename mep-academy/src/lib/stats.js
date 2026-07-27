// לוגיקת הלמידה המסתגלת: חזרה מרווחת (Leitner), שליטה פר-מודול ורצף ימי למידה.
// פונקציות טהורות בלבד — המצב עצמו חי ב-App ומסתנכרן בתוך mep_progress.

// קופסאות 1–5; אחרי כמה ימים שאלה בקופסה חוזרת (שאלה שלא נראתה — זמינה מיד)
const BOX_INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
export const MAX_BOX = 5;

// מזהה יציב לשאלה: מודול + מיקומה במאגר של המודול. הסדר בקבצי התוכן חשוב —
// הוספת שאלות באמצע מודול תזיז את המזהים (הוספה בסוף בטוחה).
export function qid(moduleId, index) {
  return `${moduleId}:${index}`;
}

// תאריכים כמחרוזות YYYY-MM-DD מקומיות — השוואה לקסיקוגרפית = השוואת ימים
export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

// שאלה נכנסת למחזור החזרה רק אחרי שנענתה פעם אחת (בחידון מודול או במבחן) —
// שאלות שטרם נלמדו שייכות למודולים, לא לחזרה היומית.
export function isDue(entry, today = todayStr()) {
  return !!entry && entry.due <= today;
}

// תשובה נכונה מקדמת קופסה, טעות מחזירה לקופסה 1 (חזרה כבר מחר)
export function applyAnswer(entry, correct, today = todayStr(), now = Date.now()) {
  const box = correct ? Math.min((entry?.box || 0) + 1, MAX_BOX) : 1;
  return { box, due: addDays(today, BOX_INTERVAL_DAYS[box]), t: now };
}

export function countDue(srs, allQids, today = todayStr()) {
  return allQids.filter((id) => isDue(srs[id], today)).length;
}

// רצף: כל יום עם פעילות לימודית מאריך; דילוג על יום מאפס (בלי ענישה — פשוט 1)
export function updateStreak(streak, today = todayStr()) {
  if (streak?.last === today) return streak;
  const yesterday = addDays(today, -1);
  const n = streak?.last === yesterday ? (streak.n || 0) + 1 : 1;
  return { n, last: today };
}

// רצף "חי" = הפעילות האחרונה היום או אתמול (אתמול — עוד אפשר להאריך אותו היום)
export function streakAlive(streak, today = todayStr()) {
  if (!streak?.last) return false;
  return streak.last === today || streak.last === addDays(today, -1);
}

export function bumpMastery(mastery, moduleId, correct) {
  const cur = mastery[moduleId] || { c: 0, w: 0 };
  return {
    ...mastery,
    [moduleId]: { c: cur.c + (correct ? 1 : 0), w: cur.w + (correct ? 0 : 1) },
  };
}

// המודולים החלשים — לפי שיעור טעויות, רק אם יש מספיק דגימות לשיפוט הוגן
export function weakestModules(mastery, moduleIds, limit = 3) {
  return moduleIds
    .map((id) => {
      const m = mastery[id];
      const n = m ? m.c + m.w : 0;
      return { id, n, errRate: n > 0 ? m.w / n : 0 };
    })
    .filter((m) => m.n >= 2 && m.errRate > 0)
    .sort((a, b) => b.errRate - a.errRate || b.n - a.n)
    .slice(0, limit)
    .map((m) => m.id);
}
