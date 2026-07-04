-- מצפן (Career Compass) — journey persistence + server-side AI-call accounting.
-- One row per journey. The client owns the assessment data (answers/interview/
-- report); the ai_calls / last_ai_call_at columns are written ONLY by the Edge
-- Function via service role — column-level grants below keep clients out.

create table if not exists public.career_journeys (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  stage            text not null default 'welcome',
  answers          jsonb not null default '{}'::jsonb,
  interview        jsonb not null default '[]'::jsonb,
  report           jsonb,
  ai_calls         integer not null default 0,
  last_ai_call_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists career_journeys_user_idx
  on public.career_journeys (user_id, created_at desc);

alter table public.career_journeys enable row level security;

create policy "career_journeys_select_own" on public.career_journeys
  for select using (auth.uid() = user_id);

create policy "career_journeys_insert_own" on public.career_journeys
  for insert with check (auth.uid() = user_id);

create policy "career_journeys_update_own" on public.career_journeys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "career_journeys_delete_own" on public.career_journeys
  for delete using (auth.uid() = user_id);

-- Column-level lockdown: clients may not set or reset the AI accounting
-- columns (ai_calls funds the per-journey Anthropic budget cap). Insert is
-- also restricted so a crafted insert can't seed ai_calls with a negative
-- number to inflate its budget.
revoke insert, update on public.career_journeys from authenticated;
grant insert (user_id, status, stage, answers, interview, report)
  on public.career_journeys to authenticated;
grant update (status, stage, answers, interview, report, updated_at)
  on public.career_journeys to authenticated;
