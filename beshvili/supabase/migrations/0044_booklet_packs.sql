-- 0044 — one-time booklet packs ("חבילת 5 חוברות — ₪15"), the no-subscription
-- conversion offer. Diagnosis behind it: only 15/170 users created a second
-- booklet and the paywall asks for a monthly commitment paid manually via Bit —
-- the highest-friction ask possible. A one-time pack matches the payment rail
-- (Bit = one-time) and lets users pay once before committing to a subscription.
--
-- Model: profiles.booklet_credits_granted is a CUMULATIVE lifetime counter of
-- purchased credits (admin adds +5 per pack). The effective free-tier lifetime
-- allowance everywhere becomes 2 + granted; credits are "consumed" implicitly
-- by total_booklets_created growing. No balance mutation on the generation
-- path → no consume/refund races, and the existing enforce_booklet_quota DB
-- trigger stays consistent with the edge-function gate by construction.

alter table public.profiles
  add column if not exists booklet_credits_granted integer not null default 0;

-- ── Align the booklet-INSERT quota trigger with the pack allowance ──────────
-- Body copied verbatim from 0032 (which restored 0019's delete-proof design +
-- FOR UPDATE serialization) with ONE change: the free-tier cap is
-- 2 + booklet_credits_granted instead of a hard 2. Without this, a pack
-- buyer's booklet would generate but the save would be rejected here.
CREATE OR REPLACE FUNCTION public.enforce_booklet_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan           text;
  v_lifetime_count integer;
  v_credits        integer;
  v_monthly_count  integer;
BEGIN
  -- Lock the profile row so concurrent INSERT attempts serialize here
  SELECT plan, total_booklets_created, coalesce(booklet_credits_granted, 0)
  INTO   v_plan, v_lifetime_count, v_credits
  FROM   public.profiles
  WHERE  id = NEW.user_id
  FOR UPDATE;

  -- Admins are exempt from all limits
  IF v_plan = 'admin' THEN RETURN NEW; END IF;

  -- Free tier: hard lifetime cap (immune to booklet deletion), extended by
  -- purchased one-time pack credits.
  IF v_plan IS NULL OR v_plan = 'free' THEN
    IF v_lifetime_count >= 2 + v_credits THEN
      RAISE EXCEPTION 'quota_exceeded: free tier limit reached' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Parent plan: 5 per calendar month
  IF v_plan = 'parent' THEN
    SELECT COUNT(*) INTO v_monthly_count
    FROM   public.booklets
    WHERE  user_id = NEW.user_id
      AND  created_at >= date_trunc('month', now());
    IF v_monthly_count >= 5 THEN
      RAISE EXCEPTION 'quota_exceeded: monthly limit reached' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Teacher / pro: 20 per calendar month
  SELECT COUNT(*) INTO v_monthly_count
  FROM   public.booklets
  WHERE  user_id = NEW.user_id
    AND  created_at >= date_trunc('month', now());
  IF v_monthly_count >= 20 THEN
    RAISE EXCEPTION 'quota_exceeded: monthly limit reached' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END; $$;

-- ── Protect booklet_credits_granted from self-update ────────────────────────
-- Body copied verbatim from 0035 (which preserves the 0027/0026 service-role +
-- nested-trigger exemptions — REQUIRED, or the lifetime-counter trigger fails
-- every booklet insert) with ONLY the booklet_credits_granted check appended.
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
  if new.booklet_credits_granted is distinct from old.booklet_credits_granted then
    raise exception 'permission denied: booklet_credits_granted is read-only';
  end if;

  return new;
end;
$$;
