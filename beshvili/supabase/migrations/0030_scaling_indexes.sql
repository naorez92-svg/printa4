-- 0030_scaling_indexes.sql
-- Fill the remaining index gaps for scale. Pure performance — no behavior change,
-- safe to run anytime. (Most hot paths were already covered: booklets(user_id,
-- created_at), booklets(share_token), events(event/user/anon/session, created_at).)

-- Global booklet date-range COUNTs (admin-stats "this week / today / month").
-- The existing booklets(user_id, created_at) index can't serve a query that
-- filters only on created_at, so those counts currently scan the table.
create index if not exists idx_booklets_created on public.booklets (created_at desc);

-- children.user_id is a FK (Postgres does not auto-index FKs) and is read per
-- user on every "my students" load.
create index if not exists idx_children_user on public.children (user_id);

-- Renewal cron filters paid users by pro_since. Partial index = only the paid
-- users carry it, so it stays tiny.
create index if not exists idx_profiles_pro_since on public.profiles (pro_since)
  where pro_since is not null;
