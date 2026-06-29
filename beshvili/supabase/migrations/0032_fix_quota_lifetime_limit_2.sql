-- 0032_fix_quota_lifetime_limit_2.sql
-- FIX a regression introduced by 0031: it CREATE-OR-REPLACE'd enforce_booklet_quota()
-- using a live COUNT(*) of the booklets table for the free tier. That reverted the
-- delete-proof design 0019 established (gate on profiles.total_booklets_created, a
-- lifetime counter that is never decremented), and it dropped the FOR UPDATE row lock
-- that serializes concurrent inserts. Consequences of 0031: a free user could DELETE
-- their booklets via REST and regenerate indefinitely, and two concurrent inserts could
-- both pass the check.
--
-- This restores 0019's logic verbatim, with the free lifetime cap set to 2 (the new model).

CREATE OR REPLACE FUNCTION public.enforce_booklet_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan           text;
  v_lifetime_count integer;
  v_monthly_count  integer;
BEGIN
  -- Lock the profile row so concurrent INSERT attempts serialize here
  SELECT plan, total_booklets_created
  INTO   v_plan, v_lifetime_count
  FROM   public.profiles
  WHERE  id = NEW.user_id
  FOR UPDATE;

  -- Admins are exempt from all limits
  IF v_plan = 'admin' THEN RETURN NEW; END IF;

  -- Free tier: hard lifetime cap (immune to booklet deletion)
  IF v_plan IS NULL OR v_plan = 'free' THEN
    IF v_lifetime_count >= 2 THEN
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
