-- 0028_email_unsubscribe.sql
-- Let recipients opt out of marketing emails (legal requirement + user request).
--
--   unsubscribed_at   — set when the user opts out; NULL = still subscribed.
--   unsubscribe_token — unguessable per-user token used in the one-click link so
--                       the unsubscribe page works without a login. A volatile
--                       default rewrites the table and gives every existing row a
--                       distinct token.

alter table public.profiles add column if not exists unsubscribed_at  timestamptz;
alter table public.profiles add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create index if not exists idx_profiles_unsub_token on public.profiles (unsubscribe_token);
