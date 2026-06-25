-- 0017_free_tier_limit_3.sql
-- Raise free-tier lifetime booklet limit from 2 → 3.
-- Aligns DB trigger with useProfile.js FREE_LIMIT = 3 and generate-booklet FREE_BOOKLET_LIMIT = 3.

CREATE OR REPLACE FUNCTION public.enforce_booklet_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_plan  text;
  v_count integer;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = NEW.user_id;

  -- Admin: no limit
  IF v_plan = 'admin' THEN RETURN NEW; END IF;

  -- Free tier: lifetime limit of 3
  IF v_plan IS NULL OR v_plan = 'free' THEN
    SELECT COUNT(*) INTO v_count FROM public.booklets WHERE user_id = NEW.user_id;
    IF v_count >= 3 THEN
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
