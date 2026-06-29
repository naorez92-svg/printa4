-- 0026_fix_lifetime_counter_trigger_conflict.sql
--
-- CRITICAL PRODUCTION FIX — restores booklet creation for every non-admin user.
--
-- ROOT CAUSE
-- ----------
-- 0019 added an AFTER-INSERT trigger on booklets (increment_booklet_lifetime_count)
-- that does `UPDATE profiles SET total_booklets_created = total_booklets_created + 1`.
-- 0024 hardened prevent_plan_self_update() to make total_booklets_created (and
-- last_generation_at, pro_since) read-only whenever auth.uid() IS NOT NULL.
--
-- The increment trigger is SECURITY DEFINER, but SECURITY DEFINER only changes the
-- executing ROLE — it does NOT clear the request's JWT claims, so auth.uid() inside
-- the trigger is still the booklet's owner. For any non-admin user the increment's
-- UPDATE therefore raised:
--     permission denied: total_booklets_created is read-only
-- which rolled back the whole booklet INSERT → the client logged `db_insert_failed`
-- and showed the booklet without saving it. Admins were exempt from the guard, so
-- only admin-plan users could create booklets. Broken since 0024 (2026-06-27).
--
-- FIX
-- ---
-- Distinguish a *nested* write (one trigger updating profiles from inside another
-- trigger — i.e. the trusted lifetime-counter increment) from a *direct* user
-- REST write, using pg_trigger_depth():
--   * Direct user PATCH /profiles  → guard runs at trigger depth 1 → enforce.
--   * Counter trigger's UPDATE     → guard runs nested at depth > 1 → allow.
-- A user cannot reach depth > 1 on a profiles UPDATE through PostgREST (they can't
-- invoke internal triggers), so the anti-tampering protection from 0024 (users
-- cannot reset their own lifetime quota / rate-limit stamp) stays fully intact.
-- This avoids a sticky transaction-local GUC, which would otherwise stay set for
-- the remainder of the transaction and could whitelist a later same-tx write.

-- 1. Increment trigger keeps its simple form (the UPDATE is what the guard must allow).
create or replace function public.increment_booklet_lifetime_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set total_booklets_created = total_booklets_created + 1
   where id = new.user_id;
  return new;
end;
$$;

-- 2. Guard allows nested (trigger-originated) writes; still blocks direct user writes.
create or replace function public.prevent_plan_self_update()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  is_admin boolean;
begin
  -- Service role (edge functions): no user JWT → allowed.
  if auth.uid() is null then
    return new;
  end if;

  -- Nested write from another trigger (e.g. the lifetime-counter increment).
  -- Users cannot reach depth > 1 on a profiles UPDATE via REST, so quota
  -- tampering stays blocked while the internal counter update is permitted.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Admins may change privileged fields.
  select (plan = 'admin') into is_admin from public.profiles where id = auth.uid();
  if coalesce(is_admin, false) then
    return new;
  end if;

  -- Everyone else: privileged columns are read-only.
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
