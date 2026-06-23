-- Track when a user became pro and when renewal reminder was sent
alter table public.profiles
  add column if not exists pro_since timestamptz,
  add column if not exists renewal_reminder_sent_at timestamptz;

create or replace function public.handle_plan_upgrade()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.plan = 'pro' and (old.plan is null or old.plan <> 'pro') then
    new.pro_since := now();
    new.renewal_reminder_sent_at := null;
  end if;
  return new;
end; $$;

create trigger on_profile_plan_upgrade
  before update on public.profiles
  for each row execute function public.handle_plan_upgrade();
