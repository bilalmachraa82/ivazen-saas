-- Harden AT sync operational visibility and override governance
-- 1) Force security_invoker on at_sync_health_view (if PG supports it)
-- 2) Add explicit RLS policies for override tables (read own/admin, write admin)

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER VIEW public.at_sync_health_view SET (security_invoker = true)';
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'Could not set security_invoker on at_sync_health_view: %', SQLERRM;
  END;
END
$$;

-- at_sync_year_overrides policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'at_sync_year_overrides'
      AND policyname = 'year_overrides_select_own_or_admin'
  ) THEN
    CREATE POLICY year_overrides_select_own_or_admin
      ON public.at_sync_year_overrides
      FOR SELECT
      USING (
        auth.uid() = accountant_id
        OR public.has_role(auth.uid(), 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'at_sync_year_overrides'
      AND policyname = 'year_overrides_admin_write'
  ) THEN
    CREATE POLICY year_overrides_admin_write
      ON public.at_sync_year_overrides
      FOR ALL
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END
$$;

-- at_sync_override_audit policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'at_sync_override_audit'
      AND policyname = 'override_audit_select_own_or_admin'
  ) THEN
    CREATE POLICY override_audit_select_own_or_admin
      ON public.at_sync_override_audit
      FOR SELECT
      USING (
        auth.uid() = accountant_id
        OR public.has_role(auth.uid(), 'admin')
      );
  END IF;
END
$$;
