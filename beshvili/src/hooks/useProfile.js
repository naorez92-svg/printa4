import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export const FREE_LIMIT = 2;

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [bookletCount, setBookletCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: p }, { count }] = await Promise.all([
        supabase.from("profiles").select("plan, full_name").eq("id", user.id).single(),
        supabase.from("booklets").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      setProfile(p);
      setBookletCount(count ?? 0);
    } catch {
      setProfile(null);
      setBookletCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const isPro = profile?.plan === "pro" || profile?.plan === "admin";
  const remaining = isPro ? Infinity : Math.max(0, FREE_LIMIT - bookletCount);

  return { profile, bookletCount, remaining, isPro, loading, refresh };
}
