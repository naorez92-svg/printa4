// עטיפת localStorage בטוחה — האפליקציה חייבת לעבוד גם בגלישה פרטית / iframe
// שבהם הגישה ל-storage זורקת חריגה.

const PREFIX = "mep-academy:";

export function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    // ערך פגום (null או טיפוס שגוי) לא יפיל את האפליקציה — חוזרים לברירת המחדל
    if (value === null || value === undefined) return fallback;
    if (fallback !== null && typeof value !== typeof fallback) return fallback;
    return value;
  } catch {
    return fallback;
  }
}

export function saveState(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage לא זמין — ממשיכים בזיכרון בלבד
  }
}

// ניקוי מלא של המצב המקומי — נקרא ביציאה מהחשבון, כדי שמשתמש אחר
// שנכנס באותו מכשיר יתחיל נקי (ההתקדמות של היוצא שמורה בענן שלו).
export function clearAllState() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage לא זמין
  }
}
