-- Track when a follow-up email was sent so we never double-send
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz;
