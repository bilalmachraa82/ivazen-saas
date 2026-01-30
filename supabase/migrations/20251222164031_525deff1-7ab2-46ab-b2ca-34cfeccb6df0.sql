-- Remove overly permissive policies that allow any authenticated user
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Require authentication for revenue_entries" ON public.revenue_entries;

-- The existing specific policies already handle access control properly:
-- profiles: owner, accountant, admin can view/update
-- revenue_entries: owner, accountant, admin can view; owner can insert/update/delete
-- No broad authentication-only policies needed