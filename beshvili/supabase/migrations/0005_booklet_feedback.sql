-- Add post-session feedback columns to booklets
ALTER TABLE public.booklets
  ADD COLUMN IF NOT EXISTS difficulty_feedback text
    CHECK (difficulty_feedback IN ('too_hard', 'just_right', 'too_easy')),
  ADD COLUMN IF NOT EXISTS session_notes text;
