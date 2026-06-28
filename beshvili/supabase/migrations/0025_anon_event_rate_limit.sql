-- 0025 — Harden anonymous event ingestion to prevent DoS.
--
-- Migration 0023 allows the anon role to INSERT into events with user_id IS NULL.
-- Without a frequency cap, any holder of the public anon key (bundled in every
-- client) can flood the table. Two mitigations are added here:
--
--   (A) Trigger: enforce max 60 anonymous event rows per anonymous_id per minute.
--       Any insert that would exceed that rate raises an exception → HTTP 400
--       (Supabase REST returns the exception as a 400 Bad Request with the message,
--       which the client analytics silently swallows — no user impact).
--
--   (B) pg_cron cleanup: purge anonymous events older than 30 days once per day
--       so the table cannot grow without bound over time.
--       Requires the pg_cron extension (enabled by default on Supabase paid plans;
--       on free tier, add it manually: Dashboard → Database → Extensions → pg_cron).

-- ── (A) Per-anonymous_id per-minute rate limit trigger ──────────────────────
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

drop trigger if exists trg_anon_event_rate on public.events;
create trigger trg_anon_event_rate
  before insert on public.events
  for each row
  execute function public.enforce_anon_event_rate();

-- ── (B) pg_cron: auto-purge anonymous events > 30 days ──────────────────────
-- NOTE: requires pg_cron extension. Enable it at:
-- https://supabase.com/dashboard/project/gywpdzkvkdisonuzhsib/database/extensions
-- Run the cron setup separately (pg_cron must be enabled first):
--
--   select cron.schedule(
--     'purge-anon-events-30d',
--     '0 3 * * *',  -- 03:00 UTC daily
--     $$delete from public.events where user_id is null and created_at < now() - interval '30 days'$$
--   );
--
-- The above SELECT is commented out because it will fail if pg_cron is not yet
-- enabled. Run it manually once pg_cron is active.
