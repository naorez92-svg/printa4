-- מצפן — bootstrap the admin account.
-- naorez92@gmail.com gets plan='admin' (unlocks the /admin dashboard and the
-- paywall bypass) and compass_paid=true. Runs as service role, so the
-- plan/compass_paid protection triggers pass (auth.uid() IS NULL).

insert into public.profiles (id, plan, compass_paid)
select id, 'admin', true
from auth.users
where email = 'naorez92@gmail.com'
on conflict (id) do update
  set plan = 'admin', compass_paid = true;
