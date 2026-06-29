-- 0029 — honor a manual unsubscribe request that couldn't be applied via the
-- table editor: opt elfifo4@gmail.com out of all marketing email. Idempotent.
update public.profiles
   set unsubscribed_at = coalesce(unsubscribed_at, now())
 where id in (select id from auth.users where lower(email) = 'elfifo4@gmail.com');
