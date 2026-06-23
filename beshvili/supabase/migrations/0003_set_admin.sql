-- Ensure plan column exists (idempotent — covers case where 0002 wasn't applied)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- Set naorez92@gmail.com to admin plan (full access, no quota limits)
UPDATE public.profiles
SET plan = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'naorez92@gmail.com'
);
