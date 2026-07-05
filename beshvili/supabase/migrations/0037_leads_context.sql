-- 0037 — make leads actionable in the admin panel.
-- Leads stored only optional name+phone; most users skip both, so the panel
-- showed "ללא שם" with no way to identify or contact the lead — even though
-- every lead is an AUTHENTICATED user whose email we know. Store the full
-- context (written by the notify-lead edge function with the service role).

alter table public.leads
  add column if not exists email  text,
  add column if not exists plan   text,
  add column if not exists method text;
