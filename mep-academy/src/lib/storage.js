// עטיפת localStorage בטוחה — האפליקציה חייבת לעבוד גם בגלישה פרטית / iframe
// שבהם הגישה ל-storage זורקת חריגה.

const PREFIX = "mep-academy:";

export function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
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
