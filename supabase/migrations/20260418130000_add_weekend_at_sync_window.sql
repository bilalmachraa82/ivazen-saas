-- Add weekend AT sync window without changing the existing */15 dispatcher.
-- Weekend slot: Saturday/Sunday 12:00-12:15 Europe/Lisbon.

DROP INDEX IF EXISTS public.uq_at_sync_automation_runs_day_slot;

CREATE UNIQUE INDEX IF NOT EXISTS uq_at_sync_automation_runs_day_slot
  ON public.at_sync_automation_runs (run_date, run_slot)
  WHERE run_slot IN ('morning', 'evening', 'weekend_midday');

COMMENT ON COLUMN public.at_sync_automation_runs.run_slot IS
'morning | evening | weekend_midday | manual';

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
  v_is_weekend boolean := EXTRACT(ISODOW FROM v_local_now)::int IN (6, 7);
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
  v_retry_batch_id uuid;
BEGIN
  SELECT token INTO v_process_webhook_token
  FROM public.internal_webhook_keys
  WHERE name = 'process_at_sync_queue'
  LIMIT 1;

  IF p_force THEN
    v_slot := 'manual';
  ELSE
    IF v_is_weekend AND v_local_time >= TIME '12:00' AND v_local_time < TIME '12:15' THEN
      v_slot := 'weekend_midday';
    ELSIF v_local_time >= TIME '19:30' AND v_local_time < TIME '19:45' THEN
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

  WITH re_enqueued AS (
    UPDATE public.at_sync_jobs
    SET status = 'pending',
        error_message = NULL,
        started_at = NULL,
        completed_at = NULL
    WHERE status = 'error'
      AND next_retry_at IS NOT NULL
      AND next_retry_at <= now()
      AND retry_count < max_retries
    RETURNING job_batch_id
  )
  SELECT count(*) INTO v_retried FROM re_enqueued;

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

  IF v_retried > 0 THEN
    FOR v_retry_batch_id IN
      SELECT DISTINCT job_batch_id
      FROM public.at_sync_jobs
      WHERE status = 'pending'
        AND retry_count > 0
    LOOP
      BEGIN
        SELECT net.http_post(
          url := v_process_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-internal-webhook-token', COALESCE(v_process_webhook_token, '')
          ),
          body := jsonb_build_object('batchId', v_retry_batch_id::text)
        )
        INTO v_request_id;
      EXCEPTION
        WHEN OTHERS THEN
          v_notes := trim(both ';' FROM concat_ws(
            '; ',
            v_notes,
            format('Failed to trigger retry batch %s (%s)', v_retry_batch_id, SQLERRM)
          ));
      END;
    END LOOP;
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
      JOIN public.profiles p
        ON p.id = ca.client_id
      LEFT JOIN public.at_credentials cred
        ON cred.client_id = ca.client_id
       AND cred.accountant_id = ca.accountant_id
      LEFT JOIN public.at_sync_health_view h
        ON h.client_id = ca.client_id
      WHERE COALESCE(NULLIF(cred.environment, ''), NULLIF(cfg.environment, ''), 'production') = 'production'
        AND (
          (
            (
              COALESCE(cred.subuser_id, '') <> ''
              OR COALESCE(cred.encrypted_username, '') <> ''
              OR COALESCE(cred.portal_nif, '') <> ''
              OR COALESCE(p.nif, '') <> ''
            )
            AND (
              COALESCE(cred.encrypted_password, '') <> ''
              OR COALESCE(cred.portal_password_encrypted, '') <> ''
            )
          )
          OR (
            COALESCE(cfg.subuser_id, '') <> ''
            AND COALESCE(cfg.subuser_password_encrypted, '') <> ''
          )
        )
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
          FROM public.at_sync_history hist
          WHERE hist.client_id = ca.client_id
            AND hist.reason_code = 'AT_YEAR_UNAVAILABLE'
            AND hist.start_date <= make_date(v_year, 1, 1)
            AND hist.end_date >= make_date(v_year, 12, 31)
            AND hist.created_at > now() - interval '30 days'
        )
        AND (
          (
            v_year = v_current_year
            AND (
              COALESCE(cred.last_sync_at, h.last_sync_at) IS NULL
              OR COALESCE(cred.last_sync_at, h.last_sync_at) < now() - (
                interval '6 hours' * power(2, LEAST(COALESCE(cred.consecutive_failures, 0), 3))
              )
              OR COALESCE(NULLIF(cred.last_sync_status, ''), NULLIF(h.status, ''), 'never') IN ('error', 'partial')
            )
          )
          OR
          (
            v_year < v_current_year
            AND NOT EXISTS (
              SELECT 1
              FROM public.at_sync_history hist
              WHERE hist.client_id = ca.client_id
                AND hist.sync_method = 'api'
                AND hist.status IN ('success', 'partial')
                AND hist.start_date <= make_date(v_year, 1, 1)
                AND hist.end_date >= make_date(v_year, 12, 31)
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

COMMENT ON FUNCTION public.run_scheduled_at_sync(boolean) IS
'Dispatches automatic AT sync jobs. Supports dedicated client rows and shared accountant connector access. Runs at PT local windows (19:30 and 06:00), plus weekend_midday on Saturdays and Sundays.';

