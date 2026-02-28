-- Migration 1: consolidate_at_security_and_overrides (idempotent)

REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) FROM anon;

GRANT EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) TO authenticated;

-- Override tables
CREATE TABLE IF NOT EXISTS public.at_sync_year_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  reason text NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_sync_year_overrides_fiscal_year_check CHECK (fiscal_year >= 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_at_sync_year_overrides_active
  ON public.at_sync_year_overrides(accountant_id, fiscal_year)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_at_sync_year_overrides_lookup
  ON public.at_sync_year_overrides(accountant_id, fiscal_year, is_active, expires_at);

ALTER TABLE public.at_sync_year_overrides ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.at_sync_override_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id uuid REFERENCES public.at_sync_year_overrides(id) ON DELETE SET NULL,
  accountant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES public.profiles(id),
  fiscal_year integer NOT NULL,
  batch_id uuid,
  source text NOT NULL DEFAULT 'sync-queue-manager',
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_at_sync_override_audit_accountant_year
  ON public.at_sync_override_audit(accountant_id, fiscal_year, used_at DESC);

ALTER TABLE public.at_sync_override_audit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_at_sync_year_override_active(
  p_accountant_id uuid,
  p_fiscal_year integer
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.at_sync_year_overrides o
    WHERE o.accountant_id = p_accountant_id
      AND o.fiscal_year = p_fiscal_year
      AND o.is_active = true
      AND (o.expires_at IS NULL OR o.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.is_at_sync_year_override_active(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_at_sync_year_override_active(uuid, integer) TO service_role;

-- Health view
CREATE OR REPLACE VIEW public.at_sync_health_view AS
WITH ranked AS (
  SELECT
    h.*,
    row_number() OVER (PARTITION BY h.client_id ORDER BY h.created_at DESC) AS rn
  FROM public.at_sync_history h
)
SELECT
  r.client_id,
  r.created_at AS last_sync_at,
  r.sync_method,
  r.status,
  r.reason_code,
  r.error_message,
  r.records_imported,
  r.records_skipped,
  r.records_errors,
  r.metadata->>'method' AS method,
  COALESCE((r.metadata#>>'{directions,compras,totalRecords}')::integer, 0) AS compras_total,
  COALESCE((r.metadata#>>'{directions,vendas,totalRecords}')::integer, 0) AS vendas_total
FROM ranked r
WHERE r.rn = 1;

GRANT SELECT ON public.at_sync_health_view TO authenticated;
GRANT SELECT ON public.at_sync_health_view TO service_role;

-- Migration 2: finalize_scheduler_year_policy

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.internal_webhook_keys (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.internal_webhook_keys(name, token)
SELECT 'process_at_sync_queue', encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.internal_webhook_keys
  WHERE name = 'process_at_sync_queue'
);

REVOKE ALL ON public.internal_webhook_keys FROM PUBLIC;
GRANT SELECT ON public.internal_webhook_keys TO service_role;

CREATE OR REPLACE FUNCTION public.run_scheduled_at_sync(p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_local_now timestamp := timezone('Europe/Lisbon', now());
  v_local_date date := v_local_now::date;
  v_local_time time := v_local_now::time;
  v_slot text;
  v_run_id uuid;
  v_current_year integer := EXTRACT(YEAR FROM v_local_now)::integer;
  v_year integer;
  v_batch_id uuid;
  v_jobs integer := 0;
  v_total_jobs integer := 0;
  v_batches jsonb := '[]'::jsonb;
  v_request_id bigint;
  v_process_url text := 'https://oqvvtcfvjkghrwaatprx.supabase.co/functions/v1/process-at-sync-queue';
  v_process_webhook_token text;
  v_notes text := '';
BEGIN
  SELECT token INTO v_process_webhook_token
  FROM public.internal_webhook_keys
  WHERE name = 'process_at_sync_queue'
  LIMIT 1;

  IF p_force THEN
    v_slot := 'manual';
  ELSE
    IF v_local_time >= TIME '19:30' AND v_local_time < TIME '19:45' THEN
      v_slot := 'evening';
    ELSIF v_local_time >= TIME '06:00' AND v_local_time < TIME '06:15' THEN
      v_slot := 'morning';
    ELSE
      RETURN jsonb_build_object(
        'success', true,
        'skipped', 'outside_window',
        'local_time', v_local_now
      );
    END IF;
  END IF;

  INSERT INTO public.at_sync_automation_runs (run_date, run_slot, local_time)
  VALUES (v_local_date, v_slot, v_local_now)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_run_id;

  IF v_run_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', 'already_ran_for_slot',
      'run_date', v_local_date,
      'slot', v_slot
    );
  END IF;

  FOR v_year IN SELECT unnest(ARRAY[v_current_year, v_current_year - 1])
  LOOP
    v_batch_id := gen_random_uuid();

    WITH eligible AS (
      SELECT DISTINCT
        ca.accountant_id,
        ca.client_id
      FROM public.client_accountants ca
      JOIN public.accountant_at_config cfg
        ON cfg.accountant_id = ca.accountant_id
       AND cfg.is_active = true
      JOIN public.at_credentials cred
        ON cred.client_id = ca.client_id
       AND cred.accountant_id = ca.accountant_id
      WHERE COALESCE(cred.portal_nif, '') <> ''
        AND COALESCE(cred.portal_password_encrypted, '') <> ''
        AND COALESCE(cred.environment, 'production') = 'production'
        AND NOT EXISTS (
          SELECT 1
          FROM public.at_sync_jobs j
          WHERE j.accountant_id = ca.accountant_id
            AND j.client_id = ca.client_id
            AND j.fiscal_year = v_year
            AND j.status IN ('pending', 'processing')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.at_sync_history h
          WHERE h.client_id = ca.client_id
            AND h.reason_code = 'AT_YEAR_UNAVAILABLE'
            AND h.start_date <= make_date(v_year, 1, 1)
            AND h.end_date >= make_date(v_year, 12, 31)
            AND h.created_at > now() - interval '30 days'
        )
        AND (
          (
            v_year = v_current_year
            AND (
              cred.last_sync_at IS NULL
              OR cred.last_sync_at < now() - interval '6 hours'
              OR COALESCE(cred.last_sync_status, 'never') IN ('error', 'partial')
            )
          )
          OR
          (
            v_year < v_current_year
            AND NOT EXISTS (
              SELECT 1
              FROM public.at_sync_history h
              WHERE h.client_id = ca.client_id
                AND h.sync_method = 'api'
                AND h.status IN ('success', 'partial')
                AND h.start_date <= make_date(v_year, 1, 1)
                AND h.end_date >= make_date(v_year, 12, 31)
            )
          )
        )
    )
    INSERT INTO public.at_sync_jobs (
      accountant_id,
      client_id,
      fiscal_year,
      status,
      job_batch_id
    )
    SELECT
      e.accountant_id,
      e.client_id,
      v_year,
      'pending',
      v_batch_id
    FROM eligible e;

    GET DIAGNOSTICS v_jobs = ROW_COUNT;

    IF v_jobs > 0 THEN
      v_total_jobs := v_total_jobs + v_jobs;
      v_batches := v_batches || jsonb_build_array(
        jsonb_build_object(
          'fiscal_year', v_year,
          'batch_id', v_batch_id,
          'jobs', v_jobs
        )
      );

      BEGIN
        SELECT net.http_post(
          url := v_process_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-internal-webhook-token', COALESCE(v_process_webhook_token, '')
          ),
          body := jsonb_build_object('batchId', v_batch_id::text)
        )
        INTO v_request_id;
      EXCEPTION
        WHEN OTHERS THEN
          v_notes := trim(both ';' FROM concat_ws(
            '; ',
            v_notes,
            format('Failed to trigger processor for year %s (%s)', v_year, SQLERRM)
          ));
      END;
    END IF;
  END LOOP;

  UPDATE public.at_sync_automation_runs
  SET total_jobs = v_total_jobs,
      batches = v_batches,
      notes = NULLIF(v_notes, '')
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'success', true,
    'run_id', v_run_id,
    'slot', v_slot,
    'local_time', v_local_now,
    'current_year', v_current_year,
    'total_jobs', v_total_jobs,
    'batches', v_batches,
    'notes', NULLIF(v_notes, '')
  );
END;
$$;

COMMENT ON FUNCTION public.run_scheduled_at_sync(boolean) IS
'Final policy: schedule current and previous year only. Force/manual bypasses time window only.';

REVOKE ALL ON FUNCTION public.run_scheduled_at_sync(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_scheduled_at_sync(boolean) TO service_role;

-- Migration 3: harden_at_sync_health_view_and_override_rls

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