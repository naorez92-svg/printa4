-- profiles (פרופיל משתמש; brand_* ל-white-label בפאזה 1)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'teacher',     -- teacher | parent | admin
  full_name text,
  brand_name text,
  brand_phone text,
  brand_logo_url text,
  created_at timestamptz default now()
);

-- children (פאזה 1)
create table public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  grade text,
  worlds text[] default '{}',
  level text default 'medium',              -- basic | medium | advanced
  special_needs text,
  created_at timestamptz default now()
);

-- booklets (פאזה 0 — פעיל)
create table public.booklets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  title text,
  child_name text,
  grade text,
  world text,
  goal text,
  level text default 'medium',
  html text,
  status text default 'ready',
  created_at timestamptz default now()
);

-- RLS: כל אחד רואה רק את שלו
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.booklets enable row level security;

create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own children" on public.children for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own booklets" on public.booklets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- יצירת פרופיל אוטומטית בהרשמה
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
