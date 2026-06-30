-- Track which follow-up emails have been sent to each user.
-- Prevents duplicate sends when the cron runs every 2 days.
create table if not exists public.email_logs (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  email_type  text        not null,
  sent_at     timestamptz default now()
);

create index if not exists email_logs_user_type
  on public.email_logs(user_id, email_type, sent_at desc);

alter table public.email_logs enable row level security;
-- Intentionally no RLS policies — only accessible via service role key.
