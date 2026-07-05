-- מצפן V5 — the live action plan + report-email delivery.
--
-- roadmap_done      — client-owned checkmarks of the report's roadmap tasks
--                     ({"stepIdx-lineIdx": true}). This is what turns the
--                     one-shot report into a plan the user returns to.
-- report_emailed_at — server-only idempotency stamp: the Edge Function sends
--                     the "your report is ready" email exactly once per
--                     journey (CAS on this column). Clients get no grant.

alter table public.career_journeys
  add column if not exists roadmap_done jsonb not null default '{}'::jsonb,
  add column if not exists report_emailed_at timestamptz;

-- Column-level grants follow the 0037 pattern: clients may write only the
-- columns they own. roadmap_done is client-updatable (checkmarks on an
-- existing row); inserts rely on the server-side default, and
-- report_emailed_at gets no client grant at all.
grant update (roadmap_done) on public.career_journeys to authenticated;
