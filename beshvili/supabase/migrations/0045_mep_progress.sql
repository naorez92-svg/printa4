-- אקדמיית MEP: סנכרון התקדמות בין מכשירים.
-- טבלה אחת, שורה למשתמש, JSONB עם כל מצב הלמידה (מודולים שהושלמו,
-- צ'ק-ליסט טופס 4, שיא מבחן). RLS: כל משתמש רואה ומעדכן רק את שלו.
-- הערה: זו טבלה של אפליקציית mep-academy — נפרדת לגמרי מטבלאות החוברות.

create table if not exists public.mep_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mep_progress enable row level security;

drop policy if exists "mep_progress_select_own" on public.mep_progress;
create policy "mep_progress_select_own" on public.mep_progress
  for select using (auth.uid() = user_id);

drop policy if exists "mep_progress_insert_own" on public.mep_progress;
create policy "mep_progress_insert_own" on public.mep_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "mep_progress_update_own" on public.mep_progress;
create policy "mep_progress_update_own" on public.mep_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
