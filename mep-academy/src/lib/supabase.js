import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// כשאין קונפיגורציה (למשל dev מקומי) — האפליקציה עובדת כרגיל בלי חשבון,
// וכפתורי ההתחברות פשוט לא מוצגים.
export const authAvailable = Boolean(url && anonKey);

export const supabase = authAvailable ? createClient(url, anonKey) : null;
