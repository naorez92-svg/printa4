import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export const FREE_LIMIT = 3;
export const PARENT_MONTHLY_LIMIT = 5;
export const TEACHER_MONTHLY_LIMIT = 20;

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [bookletCount, setBookletCount] = useState(0);
  const [monthlyBookletCount, setMonthlyBookletCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // bookletCount = total_booklets_created (lifetime, never decremented) so deleting
    // a booklet cannot reset the free-tier quota
    const [{ data: p, error: pErr }, { count: monthly }] = await Promise.all([
      supabase.from("profiles").select("plan, full_name, total_booklets_created, teacher_display_name, teacher_tagline, teacher_phone, teacher_logo_url, teacher_color").eq("id", user.id).single(),
      supabase.from("booklets").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", monthStart),
    ]);

    // On a fetch error, keep the previously-loaded profile rather than silently
    // downgrading a paying user to the free tier (locked pages, wrong quota).
    if (pErr) {
      setError(pErr);
      setLoading(false);
      return;
    }
    setError(null);
    setProfile(p);
    setBookletCount(p?.total_booklets_created ?? 0);
    setMonthlyBookletCount(monthly ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const plan    = profile?.plan ?? "free";
  const isAdmin = plan === "admin";
  const isPro   = plan === "parent" || plan === "teacher" || plan === "pro" || isAdmin;
  const remaining = isPro ? Infinity : Math.max(0, FREE_LIMIT - bookletCount);

  const monthlyLimit = isAdmin ? null
    : plan === "parent" ? PARENT_MONTHLY_LIMIT
    : (plan === "teacher" || plan === "pro") ? TEACHER_MONTHLY_LIMIT
    : null;

  const monthlyRemaining = monthlyLimit !== null
    ? Math.max(0, monthlyLimit - monthlyBookletCount)
    : null;

  return { profile, plan, bookletCount, monthlyBookletCount, monthlyLimit, monthlyRemaining, remaining, isPro, isAdmin, loading, error, refresh };
}
