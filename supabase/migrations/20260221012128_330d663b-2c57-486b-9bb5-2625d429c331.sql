-- Migration A: AT Sync Automation Scheduler
-- Source: 20260220133000_add_at_sync_automation_scheduler.sql

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.at_sync_history
ADD COLUMN IF NOT EXISTS reason_code text;

CREATE INDEX IF NOT EXISTS idx_at_sync_history_reason_code
  ON public.at_sync_history (reason_code);

CREATE TABLE IF NOT EXISTS public.at_sync_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL,
  run_slot text NOT NULL,
  local_time timestamp NOT NULL,
  total_jobs integer NOT NULL DEFAULT 0,
  batches jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  triggered_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_at_sync_automation_runs_triggered_at
  ON public.at_sync_automation_runs (triggered_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_at_sync_automation_runs_day_slot
  ON public.at_sync_automation_runs (run_date, run_slot)
  WHERE run_slot IN ('morning', 'evening');

ALTER TABLE public.at_sync_automation_runs ENABLE ROW LEVEL SECURITY;

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
  v_notes text := '';
BEGIN
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

  FOR v_year IN
    SELECT unnest(
      CASE
        WHEN p_force THEN ARRAY[v_current_year, v_current_year - 1, v_current_year - 2]
        ELSE ARRAY[v_current_year, v_current_year - 1]
      END
    )
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
          headers := '{"Content-Type":"application/json"}'::jsonb,
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
'Dispatches automatic AT sync jobs. Default years: current + previous; force/manual also includes current-2. Runs at PT local windows (19:30 and 06:00).';

REVOKE ALL ON FUNCTION public.run_scheduled_at_sync(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_scheduled_at_sync(boolean) TO service_role;

DO $$
DECLARE
  v_job_id integer;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'at-sync-auto-dispatch';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'at-sync-auto-dispatch',
    '*/15 * * * *',
    'select public.run_scheduled_at_sync(false);'
  );
END;
$$;

-- Migration B: Backfill sales invoices from invoices
-- Source: 20260220214500_add_backfill_sales_from_invoices.sql

CREATE OR REPLACE FUNCTION public.backfill_sales_invoices_from_invoices(
  p_created_after timestamptz DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH source_rows AS (
    SELECT
      i.id AS invoice_id,
      i.client_id,
      i.document_date,
      i.document_number,
      i.document_type,
      i.customer_nif,
      i.total_amount,
      i.total_vat,
      i.vat_standard,
      i.vat_intermediate,
      i.vat_reduced,
      i.base_standard,
      i.base_intermediate,
      i.base_reduced,
      i.base_exempt,
      i.fiscal_period,
      i.fiscal_region,
      i.atcud,
      i.image_path,
      i.created_at,
      p.nif AS supplier_nif
    FROM public.invoices i
    JOIN public.profiles p ON p.id = i.client_id
    WHERE i.efatura_source = 'webservice'
      AND i.supplier_nif = p.nif
      AND i.document_date IS NOT NULL
      AND (p_created_after IS NULL OR i.created_at >= p_created_after)
      AND NOT EXISTS (
        SELECT 1
        FROM public.sales_invoices s
        WHERE s.client_id = i.client_id
          AND s.supplier_nif = p.nif
          AND COALESCE(s.document_number, '') = COALESCE(i.document_number, '')
      )
  ), inserted_rows AS (
    INSERT INTO public.sales_invoices (
      client_id,
      document_date,
      document_number,
      document_type,
      customer_nif,
      customer_name,
      supplier_nif,
      total_amount,
      total_vat,
      vat_standard,
      vat_intermediate,
      vat_reduced,
      base_standard,
      base_intermediate,
      base_reduced,
      base_exempt,
      fiscal_period,
      fiscal_region,
      atcud,
      image_path,
      status,
      notes,
      created_at
    )
    SELECT
      r.client_id,
      r.document_date,
      r.document_number,
      COALESCE(r.document_type, 'FT'),
      r.customer_nif,
      NULL,
      r.supplier_nif,
      COALESCE(r.total_amount, 0),
      COALESCE(r.total_vat, 0),
      COALESCE(r.vat_standard, 0),
      COALESCE(r.vat_intermediate, 0),
      COALESCE(r.vat_reduced, 0),
      COALESCE(r.base_standard, 0),
      COALESCE(r.base_intermediate, 0),
      COALESCE(r.base_reduced, 0),
      COALESCE(r.base_exempt, 0),
      r.fiscal_period,
      COALESCE(r.fiscal_region, 'PT'),
      r.atcud,
      COALESCE(r.image_path, 'backfill/invoices'),
      'pending',
      CONCAT('Backfilled from invoices.id=', r.invoice_id),
      r.created_at
    FROM source_rows r
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted_rows;

  RETURN COALESCE(v_inserted, 0);
END;
$$;

COMMENT ON FUNCTION public.backfill_sales_invoices_from_invoices(timestamptz) IS
'Optional helper to backfill sales_invoices from webservice rows that were wrongly persisted into invoices.';

REVOKE ALL ON FUNCTION public.backfill_sales_invoices_from_invoices(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_sales_invoices_from_invoices(timestamptz) TO service_role;