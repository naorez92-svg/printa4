-- Track total booklets ever created per user (lifetime, not current count).
-- This prevents free-tier users from gaming the quota by deleting and re-creating booklets.

-- 1. Add lifetime counter column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_booklets_created integer NOT NULL DEFAULT 0;

-- 2. Backfill from existing booklet rows
UPDATE public.profiles p
SET total_booklets_created = COALESCE((
  SELECT COUNT(*) FROM public.booklets b WHERE b.user_id = p.id
), 0);

-- 3. AFTER INSERT trigger — increments the counter on each new booklet (never decremented)
CREATE OR REPLACE FUNCTION public.increment_booklet_lifetime_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET total_booklets_created = total_booklets_created + 1
  WHERE id = NEW.user_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_increment_booklet_count ON public.booklets;
CREATE TRIGGER trg_increment_booklet_count
  AFTER INSERT ON public.booklets
  FOR EACH ROW EXECUTE FUNCTION public.increment_booklet_lifetime_count();

-- 4. Update quota enforcement to use lifetime count with a row-level lock
--    to prevent concurrent-insert race conditions.
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
    IF v_lifetime_count >= 3 THEN
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
