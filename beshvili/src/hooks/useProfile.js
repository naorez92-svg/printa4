import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export const FREE_LIMIT = 2;
export const PARENT_MONTHLY_LIMIT = 5;
export const TEACHER_MONTHLY_LIMIT = 20;

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [bookletCount, setBookletCount] = useState(0);
  const [monthlyBookletCount, setMonthlyBookletCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    // Everything is wrapped so a rejected promise (network blip / storage error)
    // can NEVER leave the app stuck on the loading spinner — finally always clears it.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setProfile(null); return; }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // bookletCount = total_booklets_created (lifetime, never decremented) so deleting
      // a booklet cannot reset the free-tier quota.
      // maybeSingle(): a brand-new user whose profile row isn't visible yet returns
      // null (not an error), so they're treated as a fresh free user, not broken.
      const [{ data: p, error: pErr }, { count: monthly, error: cErr }] = await Promise.all([
        supabase.from("profiles").select("plan, full_name, total_booklets_created, teacher_display_name, teacher_tagline, teacher_phone, teacher_logo_url, teacher_color").eq("id", user.id).maybeSingle(),
        supabase.from("booklets").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", monthStart),
      ]);

      // On a real fetch error, keep the previously-loaded profile rather than silently
      // downgrading a paying user to the free tier (locked pages, wrong quota).
      if (pErr) { setError(pErr); return; }
      setError(null);
      if (p) {
        setProfile(p);
        setBookletCount(p.total_booklets_created ?? 0);
      }
      // On a count-query error keep the previous value — don't reset a paying user's
      // displayed monthly usage to 0 (which would over-state their remaining quota).
      if (!cErr) setMonthlyBookletCount(monthly ?? 0);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
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
