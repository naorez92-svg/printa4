// מטא-נתוני השיעורים — כמה שקפים יש לכל מודול — בלי לייבא את קובץ השיעורים
// המלא (~120KB). המפה מוזרקת בזמן בילד מתוך lessons.js (ראו vite.config.js),
// כך שקובץ השיעורים נטען עצל רק כשפותחים נגן שיעור, ואין סכנת סחיפה בין
// התוכן למונים.
export const LESSON_SLIDES = __LESSON_SLIDES__;

export const LESSON_COUNT = Object.keys(LESSON_SLIDES).length;

export const TOTAL_SLIDES = Object.values(LESSON_SLIDES).reduce((n, c) => n + c, 0);

export function hasLesson(moduleId) {
  return moduleId in LESSON_SLIDES;
}
