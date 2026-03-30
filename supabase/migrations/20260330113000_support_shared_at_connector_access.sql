-- Support accountant-wide AT connector access in operational dashboards and scheduler.
-- Fixes cases where sync works via accountant_at_config but UI / automation still classify
-- the client as "no_credentials" because no dedicated at_credentials row exists.

CREATE OR REPLACE VIEW public.at_control_center_view AS
WITH job_stats AS (
  SELECT
    j.accountant_id,
    j.client_id,
    count(*) FILTER (WHERE j.status = 'pending')::integer AS jobs_pending,
    count(*) FILTER (WHERE j.status = 'processing')::integer AS jobs_processing,
    count(*) FILTER (WHERE j.status = 'error')::integer AS jobs_error,
    count(*) FILTER (WHERE j.status = 'completed')::integer AS jobs_completed,
    max(j.created_at) AS last_job_at
  FROM public.at_sync_jobs j
  WHERE j.created_at > now() - interval '7 days'
  GROUP BY j.accountant_id, j.client_id
),
withholding_stats AS (
  SELECT
    w.client_id,
    count(*)::integer AS withholdings_total
  FROM public.tax_withholdings w
  WHERE w.created_at > now() - interval '365 days'
  GROUP BY w.client_id
),
candidate_stats AS (
  SELECT
    c.client_id,
    count(*) FILTER (WHERE c.status = 'pending')::integer AS withholding_candidates_pending,
    count(*) FILTER (WHERE c.status = 'pending' AND coalesce(c.confidence_score, c.confidence, 0) >= 80)::integer AS withholding_candidates_high_confidence,
    count(*) FILTER (WHERE c.status = 'rejected')::integer AS withholding_candidates_rejected
  FROM public.at_withholding_candidates c
  WHERE c.created_at > now() - interval '180 days'
  GROUP BY c.client_id
)
SELECT
  ca.accountant_id,
  p.id AS client_id,
  coalesce(p.company_name, p.full_name, 'Sem nome') AS client_name,
  p.email AS client_email,
  p.nif AS client_nif,
  (
    (
      (
        coalesce(cred.subuser_id, '') <> ''
        OR coalesce(cred.encrypted_username, '') <> ''
        OR coalesce(cred.portal_nif, '') <> ''
        OR coalesce(p.nif, '') <> ''
      )
      AND (
        coalesce(cred.encrypted_password, '') <> ''
        OR coalesce(cred.portal_password_encrypted, '') <> ''
      )
    )
    OR (
      coalesce(cfg.is_active, false) = true
      AND coalesce(cfg.subuser_id, '') <> ''
      AND coalesce(cfg.subuser_password_encrypted, '') <> ''
    )
  ) AS has_credentials,
  CASE
    WHEN (
      (
        (
          coalesce(cred.subuser_id, '') <> ''
          OR coalesce(cred.encrypted_username, '') <> ''
          OR coalesce(cred.portal_nif, '') <> ''
          OR coalesce(p.nif, '') <> ''
        )
        AND (
          coalesce(cred.encrypted_password, '') <> ''
          OR coalesce(cred.portal_password_encrypted, '') <> ''
        )
      )
      OR (
        coalesce(cfg.is_active, false) = true
        AND coalesce(cfg.subuser_id, '') <> ''
        AND coalesce(cfg.subuser_password_encrypted, '') <> ''
      )
    ) THEN coalesce(nullif(cred.environment, ''), nullif(cfg.environment, ''), 'production')
    ELSE NULL
  END AS credential_environment,
  h.last_sync_at,
  h.status AS last_sync_status,
  h.reason_code AS last_reason_code,
  h.error_message AS last_error_message,
  h.sync_method AS last_sync_method,
  coalesce(h.compras_total, 0) AS compras_total,
  coalesce(h.vendas_total, 0) AS vendas_total,
  coalesce(ws.withholdings_total, 0) AS withholdings_total,
  coalesce(cs.withholding_candidates_pending, 0) AS withholding_candidates_pending,
  coalesce(cs.withholding_candidates_high_confidence, 0) AS withholding_candidates_high_confidence,
  coalesce(cs.withholding_candidates_rejected, 0) AS withholding_candidates_rejected,
  coalesce(js.jobs_pending, 0) AS jobs_pending,
  coalesce(js.jobs_processing, 0) AS jobs_processing,
  coalesce(js.jobs_error, 0) AS jobs_error,
  coalesce(js.jobs_completed, 0) AS jobs_completed,
  js.last_job_at,
  CASE
    WHEN NOT (
      (
        (
          coalesce(cred.subuser_id, '') <> ''
          OR coalesce(cred.encrypted_username, '') <> ''
          OR coalesce(cred.portal_nif, '') <> ''
          OR coalesce(p.nif, '') <> ''
        )
        AND (
          coalesce(cred.encrypted_password, '') <> ''
          OR coalesce(cred.portal_password_encrypted, '') <> ''
        )
      )
      OR (
        coalesce(cfg.is_active, false) = true
        AND coalesce(cfg.subuser_id, '') <> ''
        AND coalesce(cfg.subuser_password_encrypted, '') <> ''
      )
    ) THEN 'no_credentials'
    WHEN h.reason_code = 'AT_AUTH_FAILED' THEN 'auth_failed'
    WHEN coalesce(js.jobs_processing, 0) > 0 THEN 'processing'
    WHEN coalesce(js.jobs_pending, 0) > 0 THEN 'queued'
    WHEN coalesce(h.status, '') = 'error' THEN 'error'
    WHEN coalesce(h.status, '') = 'partial' THEN 'partial'
    WHEN coalesce(h.status, '') = 'success' THEN 'success'
    ELSE 'never'
  END AS operational_status
FROM public.client_accountants ca
JOIN public.profiles p
  ON p.id = ca.client_id
LEFT JOIN public.at_credentials cred
  ON cred.client_id = ca.client_id
 AND cred.accountant_id = ca.accountant_id
LEFT JOIN public.accountant_at_config cfg
  ON cfg.accountant_id = ca.accountant_id
 AND cfg.is_active = true
LEFT JOIN public.at_sync_health_view h
  ON h.client_id = ca.client_id
LEFT JOIN job_stats js
  ON js.client_id = ca.client_id
 AND js.accountant_id = ca.accountant_id
LEFT JOIN withholding_stats ws
  ON ws.client_id = ca.client_id
LEFT JOIN candidate_stats cs
  ON cs.client_id = ca.client_id;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER VIEW public.at_control_center_view SET (security_invoker = true)';
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'Could not set security_invoker on at_control_center_view: %', SQLERRM;
  END;
END
$$;

REVOKE ALL ON public.at_control_center_view FROM PUBLIC;
GRANT SELECT ON public.at_control_center_view TO service_role;

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
  v_retry_batch_id uuid;
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
'Dispatches automatic AT sync jobs. Supports dedicated client rows and shared accountant connector access. Runs at PT local windows (19:30 and 06:00).';
