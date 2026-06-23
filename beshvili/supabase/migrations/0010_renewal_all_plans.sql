-- Extend pro_since tracking to cover parent and teacher plans (not just legacy 'pro')
create or replace function public.handle_plan_upgrade()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.plan in ('pro', 'parent', 'teacher')
     and (old.plan is null or old.plan not in ('pro', 'parent', 'teacher')) then
    new.pro_since := now();
    new.renewal_reminder_sent_at := null;
  end if;
  return new;
end; $$;
