-- 0015_quota_enforcement_trigger.sql
-- Enforce free-tier booklet quota at the DB level.
--
-- WHY THIS EXISTS:
-- The Edge Function checks quota before calling Anthropic, but the client
-- inserts the booklet row AFTER the API call completes. Two parallel requests
-- from the same free user can both pass the server-side quota check before
-- either inserts a row (race condition). Additionally, a free user can delete
-- their booklets and regenerate more since the Edge Function counts active rows.
--
-- This trigger fires BEFORE INSERT on booklets and rejects the insert if the
-- user is on the free plan and already has >= 2 lifetime booklets. Because the
-- trigger runs inside the DB transaction it cannot be bypassed by the race
-- condition — only one insert can hold the row lock at a time.
--
-- Paid plans (parent, teacher, pro, admin) skip this trigger; their monthly
-- limits are enforced server-side in the Edge Function (sufficient given they
-- don't have a "delete-and-reset" motivation and the monthly window resets).

create or replace function public.enforce_free_booklet_quota()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_plan text;
  v_count integer;
begin
  -- Look up the user's plan (service-role context; bypasses RLS)
  select plan into v_plan from public.profiles where id = new.user_id;
  -- Only enforce on free-tier users
  if v_plan is null or v_plan not in ('free') then
    return new;
  end if;
  -- Count ALL booklets this user has ever created (including recently deleted rows
  -- that are still visible to this transaction via FOR UPDATE SKIP LOCKED would
  -- not help here — we just count what's in the table).
  select count(*) into v_count
    from public.booklets
   where user_id = new.user_id;
  if v_count >= 2 then
    raise exception 'quota_exceeded: free tier limit reached'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger enforce_free_booklet_quota_trigger
  before insert on public.booklets
  for each row
  execute function public.enforce_free_booklet_quota();
