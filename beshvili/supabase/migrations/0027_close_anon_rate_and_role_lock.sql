-- 0027 — close two latent footguns found in the deep security scan.
--
--   (#6) Anonymous-event rate limit was bypassable with anonymous_id = NULL.
--   (#7) profiles.role was user-writable → self-promotion footgun.

-- ── (#6) Require a non-null anonymous_id on anonymous events ─────────────────
-- enforce_anon_event_rate() counts `where anonymous_id = new.anonymous_id`. When
-- new.anonymous_id IS NULL, `NULL = NULL` is NULL (never true), so recent_count
-- stays 0 and the 60/min cap never fires — a client sending anonymous_id=null
-- could flood the table unbounded. Reject anon events that carry no anonymous_id,
-- and tighten the anon INSERT policy to match. (Rotating anonymous_id per request
-- is inherent to anonymous tracking and remains mitigated by the 8KB row cap and
-- the 30-day purge from 0025.)
create or replace function public.enforce_anon_event_rate()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  recent_count integer;
begin
  -- Only applies to anonymous events (user_id IS NULL)
  if new.user_id is not null then
    return new;
  end if;

  -- Anonymous events must carry an anonymous_id, otherwise the per-id rate limit
  -- below is unenforceable (NULL never matches in the count query).
  if new.anonymous_id is null then
    raise exception 'anonymous_id required for anonymous events';
  end if;

  select count(*) into recent_count
  from public.events
  where anonymous_id = new.anonymous_id
    and user_id is null
    and created_at > now() - interval '1 minute';

  if recent_count >= 60 then
    raise exception 'rate_limited: too many anonymous events';
  end if;

  return new;
end;
$$;

-- Defense in depth: the policy itself now requires a non-null anonymous_id.
drop policy if exists "anon_insert_anonymous_events" on public.events;
create policy "anon_insert_anonymous_events" on public.events
  for insert to anon
  with check (user_id is null and anonymous_id is not null);

-- ── (#7) Lock profiles.role against self-promotion ──────────────────────────
-- role (teacher|parent|admin) was writable via the "own profile update" policy.
-- It is currently decorative (all server-side authz checks gate on `plan`), but
-- if any future check keys off `role` it becomes an instant privilege escalation.
-- Add it to the read-only set in prevent_plan_self_update, preserving the 0026
-- nested-trigger and admin/service-role exemptions.
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
  if new.role is distinct from old.role then
    raise exception 'permission denied: role can only be changed by admin';
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
