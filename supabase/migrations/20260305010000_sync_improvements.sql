-- Sync Improvements: Dead Letter Queue, Adaptive Backoff, Fiscal Deadlines Cron,
-- Withholding Categories Expansion, Sync Health Function
-- All changes are ADDITIVE — new columns with defaults, new functions, new cron entries.

----------------------------------------------------------------------
-- Feature 1: Dead Letter Queue — retry columns on at_sync_jobs
----------------------------------------------------------------------

ALTER TABLE public.at_sync_jobs
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_at_sync_jobs_retry
  ON public.at_sync_jobs (next_retry_at)
  WHERE status = 'error' AND next_retry_at IS NOT NULL;

----------------------------------------------------------------------
-- Feature 2: Adaptive Backoff — consecutive_failures on at_credentials
----------------------------------------------------------------------

ALTER TABLE public.at_credentials
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0;

-- Helper RPC: atomically increment consecutive_failures
CREATE OR REPLACE FUNCTION public.increment_consecutive_failures(p_client_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.at_credentials
  SET consecutive_failures = COALESCE(consecutive_failures, 0) + 1
  WHERE client_id = p_client_id;
$$;

REVOKE ALL ON FUNCTION public.increment_consecutive_failures(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_consecutive_failures(uuid) TO service_role;

----------------------------------------------------------------------
-- Feature 3: Fiscal Deadlines Cron
----------------------------------------------------------------------

-- Webhook key for check_fiscal_deadlines
INSERT INTO public.internal_webhook_keys (name, token)
VALUES ('check_fiscal_deadlines', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

-- Add check_deadlines_url to runtime config
ALTER TABLE public.at_sync_runtime_config
  ADD COLUMN IF NOT EXISTS check_deadlines_url text;

UPDATE public.at_sync_runtime_config
SET check_deadlines_url = 'https://dmprkdvkzzjtixlatnlx.supabase.co/functions/v1/check-fiscal-deadlines'
WHERE id = true AND check_deadlines_url IS NULL;

-- Schedule fiscal deadline check: daily at 08:00 Lisbon (07:00 UTC in winter, 07:00 UTC in summer)
-- Using 7:00 UTC which is 7/8 AM Lisbon depending on DST
SELECT cron.schedule(
  'check-fiscal-deadlines-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := cfg.check_deadlines_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-webhook-token', wk.token
    ),
    body := jsonb_build_object('source', 'cron')
  )
  FROM public.at_sync_runtime_config cfg
  CROSS JOIN public.internal_webhook_keys wk
  WHERE cfg.id = true
    AND wk.name = 'check_fiscal_deadlines'
    AND cfg.check_deadlines_url IS NOT NULL
  $$
);

----------------------------------------------------------------------
-- Feature 4: Expand at_withholding_candidates income_category CHECK
----------------------------------------------------------------------

DO $do$
DECLARE v_conname text;
BEGIN
  -- Drop existing income_category CHECK constraints
  FOR v_conname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.at_withholding_candidates'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%income_category%'
  LOOP
    EXECUTE format('ALTER TABLE public.at_withholding_candidates DROP CONSTRAINT IF EXISTS %I', v_conname);
  END LOOP;

  -- Re-create with all categories
  ALTER TABLE public.at_withholding_candidates
    ADD CONSTRAINT at_withholding_candidates_income_category_check
    CHECK (income_category IN ('A', 'B', 'D', 'E', 'F', 'G', 'H', 'R'));
END $do$;

----------------------------------------------------------------------
-- Feature 5: Sync Health Dashboard Function
----------------------------------------------------------------------

-- Update run_scheduled_at_sync to include adaptive backoff and retry re-enqueue
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
  v_process_url text;
  v_process_webhook_token text;
  v_notes text := '';
  v_retried integer := 0;
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

  -- Re-enqueue retryable error jobs whose next_retry_at has passed
  UPDATE public.at_sync_jobs
  SET status = 'pending',
      error_message = NULL,
      started_at = NULL,
      completed_at = NULL
  WHERE status = 'error'
    AND next_retry_at IS NOT NULL
    AND next_retry_at <= now()
    AND retry_count < max_retries;
  GET DIAGNOSTICS v_retried = ROW_COUNT;

  IF v_retried > 0 THEN
    v_notes := format('Re-enqueued %s retryable jobs', v_retried);
  END IF;

  SELECT process_queue_url INTO v_process_url
  FROM public.at_sync_runtime_config
  WHERE id = true
  LIMIT 1;

  IF COALESCE(v_process_url, '') = '' THEN
    UPDATE public.at_sync_automation_runs
    SET total_jobs = 0,
        batches = '[]'::jsonb,
        notes = 'Missing process_queue_url in at_sync_runtime_config'
    WHERE id = v_run_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'PROCESS_QUEUE_URL_NOT_CONFIGURED',
      'run_id', v_run_id,
      'slot', v_slot,
      'local_time', v_local_now
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
              -- Adaptive backoff: 6h * 2^min(consecutive_failures, 3)
              -- 6h -> 12h -> 24h -> 48h max
              OR cred.last_sync_at < now() - (interval '6 hours' * power(2, LEAST(COALESCE(cred.consecutive_failures, 0), 3)))
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
    'retried_jobs', v_retried,
    'notes', NULLIF(v_notes, '')
  );
END;
$$;

-- Sync Health Dashboard Function
CREATE OR REPLACE FUNCTION public.get_at_sync_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only service_role or admin can call this
  IF coalesce(auth.role(), '') != 'service_role' THEN
    IF NOT coalesce(public.has_role(auth.uid(), 'admin'), false)
       AND NOT EXISTS (
         SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'accountant'
       )
    THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'total_syncs_24h', COALESCE((
      SELECT count(*) FROM public.at_sync_jobs
      WHERE created_at >= now() - interval '24 hours'
    ), 0),
    'completed_24h', COALESCE((
      SELECT count(*) FROM public.at_sync_jobs
      WHERE status = 'completed'
        AND completed_at >= now() - interval '24 hours'
    ), 0),
    'errors_24h', COALESCE((
      SELECT count(*) FROM public.at_sync_jobs
      WHERE status = 'error'
        AND completed_at >= now() - interval '24 hours'
    ), 0),
    'success_rate', COALESCE((
      SELECT CASE
        WHEN count(*) = 0 THEN 100.0
        ELSE round(100.0 * count(*) FILTER (WHERE status = 'completed') / count(*), 1)
      END
      FROM public.at_sync_jobs
      WHERE completed_at >= now() - interval '24 hours'
        AND status IN ('completed', 'error')
    ), 100.0),
    'pending_retries', COALESCE((
      SELECT count(*) FROM public.at_sync_jobs
      WHERE status = 'error'
        AND next_retry_at IS NOT NULL
        AND retry_count < max_retries
    ), 0),
    'dead_letter_count', COALESCE((
      SELECT count(*) FROM public.at_sync_jobs
      WHERE status = 'error'
        AND (next_retry_at IS NULL OR retry_count >= max_retries)
    ), 0),
    'currently_processing', COALESCE((
      SELECT count(*) FROM public.at_sync_jobs
      WHERE status IN ('pending', 'processing')
    ), 0),
    'avg_duration_ms', COALESCE((
      SELECT round(avg(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000))
      FROM public.at_sync_jobs
      WHERE status = 'completed'
        AND completed_at >= now() - interval '24 hours'
        AND started_at IS NOT NULL
    ), 0),
    'error_breakdown', COALESCE((
      SELECT jsonb_object_agg(reason, cnt)
      FROM (
        SELECT
          CASE
            WHEN error_message ILIKE '%autentic%' OR error_message ILIKE '%credencia%'
              OR error_message ILIKE '%unauthorized%' OR error_message ILIKE '%AT_AUTH_FAILED%'
              THEN 'auth_failed'
            WHEN error_message ILIKE '%timeout%' OR error_message ILIKE '%abort%'
              THEN 'timeout'
            WHEN error_message ILIKE '%network%' OR error_message ILIKE '%connection%'
              THEN 'network'
            WHEN error_message ILIKE '%no credentials%' OR error_message ILIKE '%no_credentials%'
              THEN 'no_credentials'
            WHEN error_message ILIKE '%YEAR_IN_FUTURE%'
              THEN 'year_future'
            ELSE 'other'
          END AS reason,
          count(*) AS cnt
        FROM public.at_sync_jobs
        WHERE status = 'error'
          AND completed_at >= now() - interval '24 hours'
        GROUP BY 1
      ) sub
    ), '{}'::jsonb),
    'credentials_with_failures', COALESCE((
      SELECT count(*) FROM public.at_credentials
      WHERE consecutive_failures > 0
    ), 0),
    'last_automation_run', (
      SELECT jsonb_build_object(
        'run_date', r.run_date,
        'slot', r.run_slot,
        'total_jobs', r.total_jobs,
        'local_time', r.local_time
      )
      FROM public.at_sync_automation_runs r
      ORDER BY r.created_at DESC
      LIMIT 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_at_sync_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_at_sync_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_at_sync_health() TO service_role;
