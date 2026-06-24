-- events: user behaviour funnel tracking
create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  event      text not null,
  metadata   jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_events_event_created on public.events (event, created_at desc);
create index if not exists idx_events_user_created  on public.events (user_id, created_at desc);

alter table public.events enable row level security;
create policy "users_insert_own_events" on public.events
  for insert to authenticated
  with check (auth.uid() = user_id);

-- proposals: daily AI-agent suggestions waiting for admin approval
create table if not exists public.proposals (
  id             uuid primary key default gen_random_uuid(),
  agent          text not null,          -- 'financial' | 'product' | 'health'
  title          text not null,
  description    text not null,
  action_type    text default 'info_only', -- 'info_only' | 'whatsapp'
  action_payload jsonb default '{}',
  status         text default 'pending',   -- 'pending' | 'approved' | 'dismissed'
  created_at     timestamptz default now(),
  reviewed_at    timestamptz
);

alter table public.proposals enable row level security;
create policy "admin_manage_proposals" on public.proposals
  for all
  using      (exists (select 1 from public.profiles where id = auth.uid() and plan = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and plan = 'admin'));
