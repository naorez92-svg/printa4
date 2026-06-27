-- 0023 — full-funnel analytics: allow anonymous (pre-login) event tracking.
--
-- Before this, events.user_id was NOT NULL and only authenticated users could
-- insert, so the entire top of the funnel (landing views, CTA clicks, signup
-- attempts, shared-booklet views) was unmeasurable. This lets logged-out
-- visitors emit events tied to a client-generated anonymous_id, which we later
-- stitch to a user_id via an "identify" event on signup/login.

-- 1. user_id may now be null (anonymous events).
alter table public.events alter column user_id drop not null;

-- 2. Stitching + session columns.
alter table public.events add column if not exists anonymous_id text;
alter table public.events add column if not exists session_id  text;

create index if not exists idx_events_anon_created    on public.events (anonymous_id, created_at desc);
create index if not exists idx_events_session_created on public.events (session_id, created_at desc);

-- 3. Cap the blast radius of anonymous inserts (the anon key is public): bound
--    the size of attacker-controllable columns so a flood can't bloat rows or
--    stress the admin-stats aggregation. NOT VALID skips re-checking existing
--    rows (none violate these anyway).
do $$ begin
  alter table public.events add constraint events_event_len
    check (char_length(event) <= 64) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.events add constraint events_anon_len
    check (anonymous_id is null or char_length(anonymous_id) <= 64) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.events add constraint events_meta_size
    check (char_length(metadata::text) <= 8192) not valid;
exception when duplicate_object then null; end $$;

-- 4. Allow the anon role to insert ONLY anonymous rows (user_id must be null).
--    Authenticated inserts keep the existing "auth.uid() = user_id" policy, so a
--    logged-in client cannot forge anonymous rows and vice-versa.
drop policy if exists "anon_insert_anonymous_events" on public.events;
create policy "anon_insert_anonymous_events" on public.events
  for insert to anon
  with check (user_id is null);
