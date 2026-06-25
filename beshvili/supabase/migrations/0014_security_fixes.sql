-- 0014_security_fixes.sql
-- Fix critical RLS vulnerabilities found in security audit

-- ─── 1. events: missing SELECT policy ───────────────────────────────────────
-- Any authenticated user could previously read ALL events from ALL users.
create policy "users_select_own_events" on public.events
  for select to authenticated
  using (auth.uid() = user_id);

-- ─── 2. feedback: missing SELECT policy ─────────────────────────────────────
-- Any authenticated user could previously read ALL feedback messages.
create policy "users_select_own_feedback" on public.feedback
  for select to authenticated
  using (auth.uid() = user_id);

-- ─── 3. leads: missing SELECT policy ────────────────────────────────────────
-- Any authenticated user could previously read ALL leads (phone numbers, names).
create policy "users_select_own_leads" on public.leads
  for select to authenticated
  using (auth.uid() = user_id);

-- ─── 4. profiles: prevent self-promotion ────────────────────────────────────
-- The existing "own profile update" policy allowed users to change ANY column,
-- including plan. A user could self-promote to 'admin' via:
--   supabase.from("profiles").update({ plan: "admin" }).eq("id", myUserId)
-- This trigger blocks plan changes unless called with service role (auth.uid() IS NULL).
create or replace function public.prevent_plan_self_update()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.plan <> old.plan and auth.uid() is not null then
    raise exception 'permission denied: plan can only be changed by admin';
  end if;
  return new;
end;
$$;

create trigger enforce_plan_immutable
  before update on public.profiles
  for each row
  execute function public.prevent_plan_self_update();
