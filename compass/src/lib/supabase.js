import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail loud at startup if the build is misconfigured, instead of producing a
// client that throws opaque "Failed to fetch" errors on every auth/DB call.
if (!url || !anonKey) {
  console.error("[mitzpen] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — check the build's environment variables.");
}

export const supabase = createClient(url, anonKey);
