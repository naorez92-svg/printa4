-- 0036 — the feedback loop: results reported for a printed booklet.
-- A QR on the printed page links to /f/{share_token}; the student/parent/teacher
-- fills a 10-second form (no login). Results feed the owner's dashboard and the
-- "corrective booklet" generator. Writes go ONLY through the record-booklet-result
-- edge function (service role) — the share token is the capability.

create table if not exists public.booklet_results (
  id           uuid primary key default gen_random_uuid(),
  booklet_id   uuid not null references public.booklets(id) on delete cascade,
  filled_by    text not null check (filled_by in ('student', 'parent', 'teacher')),
  difficulty   text check (difficulty in ('too_hard', 'just_right', 'too_easy')),
  mistakes     text check (mistakes in ('none', 'few', 'many')),
  hard_text    text check (char_length(hard_text) <= 300),
  created_at   timestamptz not null default now()
);

create index if not exists booklet_results_booklet_idx
  on public.booklet_results (booklet_id, created_at desc);

alter table public.booklet_results enable row level security;

-- Owners read results for their own booklets (dashboard / corrective flow).
create policy "owner_reads_own_booklet_results" on public.booklet_results
  for select to authenticated
  using (exists (
    select 1 from public.booklets b
    where b.id = booklet_id and b.user_id = auth.uid()
  ));

-- No INSERT/UPDATE/DELETE policies for anon/authenticated: the edge function
-- writes with the service role after validating the share token and rate caps.
