-- Drop the legacy quota trigger function from migration 0015.
-- Its trigger was already dropped in 0016; this removes the dead function body.
DROP FUNCTION IF EXISTS public.enforce_free_booklet_quota();
