-- 0035 — close a quota-bypass audit finding:
-- The quota gate counted SAVED booklets (total_booklets_created is incremented by
-- a trigger on the client's insert). A user calling the generate edge function
-- directly (curl + their JWT) and never inserting was never counted — unlimited
-- free Opus generations at the owner's expense. Count generation STARTS server-side.

-- ── Generation counters ──────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists total_generations_started integer not null default 0,
  add column if not exists monthly_generations_started integer not null default 0,
  add column if not exists generations_month text;

-- Initialize from existing booklet counts so users who already used their quota
-- can't start fresh.
update public.profiles
   set total_generations_started = coalesce(total_booklets_created, 0)
 where total_generations_started < coalesce(total_booklets_created, 0);

-- ── Atomic increment, called by the generate edge functions per generation ──
create or replace function public.record_generation_start(p_user_id uuid)
returns table (total_gens integer, monthly_gens integer)
language plpgsql security definer
set search_path = public as $$
declare
  cur_month text := to_char(now(), 'YYYY-MM');
begin
  update public.profiles
     set total_generations_started   = total_generations_started + 1,
         monthly_generations_started = case when generations_month = cur_month
                                            then monthly_generations_started + 1
                                            else 1 end,
         generations_month           = cur_month
   where id = p_user_id
   returning total_generations_started, monthly_generations_started
     into total_gens, monthly_gens;
  if not found then
    -- No profile row yet (brand-new user): treat as first generation.
    total_gens := 1; monthly_gens := 1;
  end if;
  return next;
end;
$$;

-- Refund a generation that failed before producing meaningful output, so a
-- transient Anthropic error doesn't burn a free user's lifetime quota.
create or replace function public.record_generation_failure(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  update public.profiles
     set total_generations_started   = greatest(0, total_generations_started - 1),
         monthly_generations_started = greatest(0, monthly_generations_started - 1)
   where id = p_user_id;
end;
$$;

-- Only the service role (edge functions) may call these.
revoke all on function public.record_generation_start(uuid)   from public, anon, authenticated;
revoke all on function public.record_generation_failure(uuid) from public, anon, authenticated;

-- ── Protect the new columns from self-update ────────────────────────────────
-- Body copied verbatim from 0027 (which itself preserves the 0026 nested-trigger
-- exemption — REQUIRED, or the lifetime-counter trigger fails every booklet
-- insert) with ONLY the generation-counter checks appended at the end.
create or replace function public.prevent_plan_self_update()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  is_admin boolean;
begin
  -- Service role (edge functions): no user JWT → allowed.
  if auth.uid() is null then
    return new;
  end if;

  -- Nested write from another trigger (e.g. the lifetime-counter increment).
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Admins may change privileged fields.
  select (plan = 'admin') into is_admin from public.profiles where id = auth.uid();
  if coalesce(is_admin, false) then
    return new;
  end if;

  -- Everyone else: privileged columns are read-only.
  if new.plan <> old.plan then
    raise exception 'permission denied: plan can only be changed by admin';
  end if;
  if new.role is distinct from old.role then
    raise exception 'permission denied: role can only be changed by admin';
  end if;
  if new.total_booklets_created is distinct from old.total_booklets_created then
    raise exception 'permission denied: total_booklets_created is read-only';
  end if;
  if new.last_generation_at is distinct from old.last_generation_at then
    raise exception 'permission denied: last_generation_at is read-only';
  end if;
  if new.pro_since is distinct from old.pro_since then
    raise exception 'permission denied: pro_since is read-only';
  end if;
  if new.total_generations_started is distinct from old.total_generations_started
     or new.monthly_generations_started is distinct from old.monthly_generations_started
     or new.generations_month is distinct from old.generations_month then
    raise exception 'permission denied: generation counters are read-only';
  end if;

  return new;
end;
$$;
