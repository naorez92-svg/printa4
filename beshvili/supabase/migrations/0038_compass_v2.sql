-- מצפן v2 — reliability + monetization.
--
-- 1. career_journeys.analyses: the three expert analyses are now persisted
--    server-side by the Edge Function, so a failed synthesis retries without
--    re-running (and re-billing) the expert agents, and nothing is lost if the
--    client disconnects. Written ONLY via service role — no client grant.
-- 2. profiles.compass_paid: the report paywall entitlement. Set manually by
--    the admin after a Bit/WhatsApp payment (same flow as plan upgrades).
--    Protected from self-service updates by a trigger, like profiles.plan.

alter table public.career_journeys
  add column if not exists analyses jsonb;

alter table public.profiles
  add column if not exists compass_paid boolean not null default false;

-- Block self-service flips of compass_paid (mirrors prevent_plan_self_update):
-- service-role calls have auth.uid() IS NULL and pass through.
create or replace function public.prevent_compass_paid_self_update()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.compass_paid is distinct from old.compass_paid and auth.uid() is not null then
    raise exception 'permission denied: compass_paid can only be changed by admin';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_compass_paid_immutable on public.profiles;
create trigger enforce_compass_paid_immutable
  before update on public.profiles
  for each row
  execute function public.prevent_compass_paid_self_update();
