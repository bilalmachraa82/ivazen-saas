-- Fix get_at_sync_health: at_sync_automation_runs uses triggered_at, not created_at
CREATE OR REPLACE FUNCTION public.get_at_sync_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
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
            WHEN error_message ILIKE '%período válido%' OR error_message ILIKE '%não disponível%'
              THEN 'time_window'
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
      ORDER BY r.triggered_at DESC
      LIMIT 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
