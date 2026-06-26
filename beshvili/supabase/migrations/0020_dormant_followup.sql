-- Track dormant re-engagement emails separately from initial D+2 followup
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dormant_followup_sent_at timestamptz;
