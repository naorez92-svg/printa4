import { supabase } from "../lib/supabase";

let _userId = null;

async function getUserId() {
  if (_userId) return _userId;
  const { data: { user } } = await supabase.auth.getUser();
  _userId = user?.id ?? null;
  return _userId;
}

supabase.auth.onAuthStateChange((_e, s) => {
  _userId = s?.user?.id ?? null;
});

export async function track(event, metadata = {}) {
  try {
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from("events").insert({ user_id: userId, event, metadata });
  } catch {}
}
