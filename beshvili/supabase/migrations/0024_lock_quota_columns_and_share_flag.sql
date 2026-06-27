-- 0024 — close two audit findings:
--   (A) quota-control columns were user-writable → free users could reset their
--       own counters via the REST API and bypass the lifetime quota / rate limit.
--   (B) every booklet was readable by its share_token the moment it was created
--       (no "the user actually shared this" flag).

-- ── (A) Protect privileged columns from self-update ─────────────────────────
-- The existing trigger (0014) only blocked `plan` changes. total_booklets_created
-- (lifetime quota), last_generation_at (rate limit), and pro_since are equally
-- privileged — a normal user must never write them. Service role (auth.uid() IS
-- NULL) and admins may still change them.
create or replace function public.prevent_plan_self_update()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  is_admin boolean;
begin
  if auth.uid() is null then
    return new; -- service role (edge functions / triggers): allowed
  end if;
  select (plan = 'admin') into is_admin from public.profiles where id = auth.uid();
  if coalesce(is_admin, false) then
    return new; -- admins may change privileged fields
  end if;
  if new.plan <> old.plan then
    raise exception 'permission denied: plan can only be changed by admin';
  end if;
  if new.total_booklets_created is distinct from old.total_booklets_created then
    raise exception 'permission denied: total_booklets_created is read-only';
  end if;
  if new.last_generation_at is distinct from old.last_generation_at then
    raise exception 'permission denied: last_generation_at is read-only';
  end if;
  if new.pro_since is distinct from old.pro_since then
    raise exception 'permission denied: pro_since is read-only';
  end if;
  return new;
end;
$$;
-- trigger `enforce_plan_immutable` from 0014 already points at this function.

-- ── (B) Booklet sharing is opt-in ───────────────────────────────────────────
alter table public.booklets add column if not exists is_public boolean not null default false;
-- Backfill: existing booklets keep working (their already-shared links stay live).
update public.booklets set is_public = true where is_public = false;
-- New booklets are private until the user explicitly shares (sets is_public=true),
-- enforced in the view-booklet edge function (.eq('is_public', true)).
