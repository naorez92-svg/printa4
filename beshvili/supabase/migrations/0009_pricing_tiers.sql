-- Extend plan constraint to support two-tier pricing: parent (19₪/5) and teacher (59₪/20)
-- "pro" remains valid as a legacy plan treated as teacher-level
alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'parent', 'teacher', 'admin'));
