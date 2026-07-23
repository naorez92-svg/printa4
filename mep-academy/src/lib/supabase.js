import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// כשאין קונפיגורציה (למשל dev מקומי) — האפליקציה עובדת כרגיל בלי חשבון,
// וכפתורי ההתחברות פשוט לא מוצגים.
export const authAvailable = Boolean(url && anonKey);

export const supabase = authAvailable ? createClient(url, anonKey) : null;

// כניסה עם Google — משותף לדף הנחיתה ולדיאלוג ההתחברות.
// מחזיר null בהצלחה (הדפדפן עוזב לגוגל), או הודעת שגיאה בעברית.
export async function signInWithGoogle() {
  if (!supabase) return "התחברות אינה זמינה כרגע.";
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (!error) return null;
  return error.message?.includes("not enabled")
    ? "כניסת Google עוד לא הופעלה בהגדרות — אפשר להיכנס בינתיים עם אימייל."
    : "הכניסה עם Google נכשלה — נסו שוב או היכנסו עם אימייל.";
}
