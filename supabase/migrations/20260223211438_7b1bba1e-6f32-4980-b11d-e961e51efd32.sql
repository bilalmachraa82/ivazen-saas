
-- Migration: limit scheduler to current and previous year only
-- Replaces run_scheduled_at_sync so p_force bypasses time-window only (no current-2 year)

CREATE OR REPLACE FUNCTION public.run_scheduled_at_sync(p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF v_run_id IS NULL AND NOT p_force THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', 'already_ran_for_slot',
      'run_date', v_local_date,
      'slot', v_slot
    );
  END IF;

  -- If force and run_id is null (already ran), generate a new run_id
  IF v_run_id IS NULL THEN
    INSERT INTO public.at_sync_automation_runs (run_date, run_slot, local_time)
    VALUES (v_local_date, v_slot || '_force_' || extract(epoch from now())::text, v_local_now)
    RETURNING id INTO v_run_id;
  END IF;

  -- IMPORTANT: Only current year and previous year. Never current-2.
  FOR v_year IN
    SELECT unnest(ARRAY[v_current_year, v_current_year - 1])
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
$function$;

-- Backfill: mark existing AT sales as validated
UPDATE public.sales_invoices
SET status = 'validated',
    validated_at = now()
WHERE image_path LIKE 'at-webservice-sales/%'
  AND (status IS NULL OR status = 'pending');
