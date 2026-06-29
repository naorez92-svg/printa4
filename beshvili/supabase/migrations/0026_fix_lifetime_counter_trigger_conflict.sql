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
-- The increment trigger sets a transaction-local marker before its UPDATE; the
-- guard treats that marker as a trusted internal write and allows it. A normal
-- REST PATCH from a user cannot set this marker, so the anti-tampering protection
-- added in 0024 (users can't reset their own lifetime quota) stays fully intact.

-- 1. Increment trigger flags its own write as trusted (transaction-local).
create or replace function public.increment_booklet_lifetime_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.trusted_counter_write', 'on', true); -- local to this tx
  update public.profiles
     set total_booklets_created = total_booklets_created + 1
   where id = new.user_id;
  return new;
end;
$$;

-- 2. Guard allows the trusted internal write; still blocks direct user tampering.
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

  -- Trusted internal write from the lifetime-counter trigger → allowed.
  -- Users cannot set this GUC through PostgREST, so quota tampering stays blocked.
  if coalesce(current_setting('app.trusted_counter_write', true), '') = 'on' then
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
