-- Set naorez92@gmail.com to admin plan (full access, no quota limits)
-- Runs after 0002_commercial.sql which adds the plan column
UPDATE public.profiles
SET plan = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'naorez92@gmail.com'
);
