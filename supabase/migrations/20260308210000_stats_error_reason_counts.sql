-- Add error_reason_counts to get_at_control_center_stats
-- This counts reason codes ONLY for operational_status='error' rows,
-- enabling accurate subtraction of informational reasons from the error count.
-- The existing reason_counts spans all statuses and cannot be safely subtracted
-- from error-only counts.

CREATE OR REPLACE FUNCTION public.get_at_control_center_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_clients', count(*),
    'with_credentials', count(*) FILTER (WHERE has_credentials),
    'requires_attention', count(*) FILTER (WHERE operational_status IN ('auth_failed', 'error', 'no_credentials')),
    'status_counts', COALESCE(
      jsonb_object_agg(operational_status, cnt) FILTER (WHERE operational_status IS NOT NULL),
      '{}'::jsonb
    ),
    'reason_counts', '{}'::jsonb,
    'error_reason_counts', '{}'::jsonb
  )
  INTO v_result
  FROM (
    SELECT operational_status, has_credentials, count(*) OVER (PARTITION BY operational_status) AS cnt
    FROM public.at_control_center_view
    WHERE accountant_id = auth.uid()
  ) sub;

  -- Add reason_counts (all statuses) for filter dropdowns
  v_result := v_result || jsonb_build_object(
    'reason_counts',
    COALESCE(
      (SELECT jsonb_object_agg(last_reason_code, rc)
       FROM (
         SELECT last_reason_code, count(*) AS rc
         FROM public.at_control_center_view
         WHERE accountant_id = auth.uid()
           AND last_reason_code IS NOT NULL
         GROUP BY last_reason_code
       ) r),
      '{}'::jsonb
    )
  );

  -- Add error_reason_counts (only operational_status='error')
  -- This is the safe universe for subtracting informational reasons from error count
  v_result := v_result || jsonb_build_object(
    'error_reason_counts',
    COALESCE(
      (SELECT jsonb_object_agg(last_reason_code, rc)
       FROM (
         SELECT last_reason_code, count(*) AS rc
         FROM public.at_control_center_view
         WHERE accountant_id = auth.uid()
           AND operational_status = 'error'
           AND last_reason_code IS NOT NULL
         GROUP BY last_reason_code
       ) r),
      '{}'::jsonb
    )
  );

  RETURN COALESCE(v_result, jsonb_build_object(
    'total_clients', 0,
    'with_credentials', 0,
    'requires_attention', 0,
    'status_counts', '{}'::jsonb,
    'reason_counts', '{}'::jsonb,
    'error_reason_counts', '{}'::jsonb
  ));
END;
$fn$;
