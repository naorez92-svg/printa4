-- add plan column to profiles (free | pro | admin)
alter table public.profiles
  add column if not exists plan text not null default 'free';
