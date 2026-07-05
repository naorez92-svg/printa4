-- מצפן V6 — "שאל את הפסיכולוג": post-report follow-up chat.
--
-- followup — [{q, a, at}] appended ONLY by the Edge Function (service role).
-- The server enforces the per-journey cap (5 questions) by reading this
-- array's length, so the column gets no client write grant. Clients may
-- still SELECT it (RLS limits them to their own rows) to render history.

alter table public.career_journeys
  add column if not exists followup jsonb not null default '[]'::jsonb;
