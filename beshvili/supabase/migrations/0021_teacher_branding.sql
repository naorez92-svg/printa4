-- Teacher branding: personal name, logo, tagline, phone and color theme
-- printed on every booklet for teacher-plan users
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS teacher_display_name text,
  ADD COLUMN IF NOT EXISTS teacher_tagline       text,
  ADD COLUMN IF NOT EXISTS teacher_phone         text,
  ADD COLUMN IF NOT EXISTS teacher_logo_url      text,
  ADD COLUMN IF NOT EXISTS teacher_color         text DEFAULT 'purple';
