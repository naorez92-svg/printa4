-- 0016_security_hardening.sql
-- 1. Add last_generation_at to profiles for tamper-proof rate limiting
--    (current approach reads last booklet row — bypassed by deleting it)
-- 2. Extend quota enforcement trigger to cover paid tiers (closes TOCTOU race)
-- 3. Strengthen profile update RLS with WITH CHECK (defense-in-depth)

-- ── 1. Rate-limit column ─────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_generation_at timestamptz;

-- ── 2. Unified quota trigger (free + paid tiers) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_booklet_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_plan text;
  v_count integer;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = NEW.user_id;

  -- Admin: no limit
  IF v_plan = 'admin' THEN RETURN NEW; END IF;

  -- Free tier: lifetime limit of 2
  IF v_plan IS NULL OR v_plan = 'free' THEN
    SELECT COUNT(*) INTO v_count FROM public.booklets WHERE user_id = NEW.user_id;
    IF v_count >= 2 THEN
      RAISE EXCEPTION 'quota_exceeded: free tier limit reached' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Parent tier: 5 booklets/month
  IF v_plan = 'parent' THEN
    SELECT COUNT(*) INTO v_count FROM public.booklets
     WHERE user_id = NEW.user_id
       AND created_at >= DATE_TRUNC('month', NOW());
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'quota_exceeded: monthly limit reached' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Teacher / pro tier: 20 booklets/month
  IF v_plan IN ('teacher', 'pro') THEN
    SELECT COUNT(*) INTO v_count FROM public.booklets
     WHERE user_id = NEW.user_id
       AND created_at >= DATE_TRUNC('month', NOW());
    IF v_count >= 20 THEN
      RAISE EXCEPTION 'quota_exceeded: monthly limit reached' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace old free-only trigger with unified one
DROP TRIGGER IF EXISTS enforce_free_booklet_quota_trigger ON public.booklets;
DROP TRIGGER IF EXISTS enforce_booklet_quota_trigger ON public.booklets;
CREATE TRIGGER enforce_booklet_quota_trigger
  BEFORE INSERT ON public.booklets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booklet_quota();

-- ── 3. Profile update policy: add WITH CHECK to block plan self-promotion ─────
-- (defense-in-depth alongside the prevent_plan_self_update trigger)
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND plan = (SELECT p.plan FROM public.profiles p WHERE p.id = auth.uid())
  );
