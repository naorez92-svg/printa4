-- הוספת plan לפרופיל (free | pro | admin)
alter table public.profiles
  add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro', 'admin'));

-- אינדקס לספירת חוברות מהירה (quota check)
create index if not exists booklets_user_created
  on public.booklets (user_id, created_at desc);
