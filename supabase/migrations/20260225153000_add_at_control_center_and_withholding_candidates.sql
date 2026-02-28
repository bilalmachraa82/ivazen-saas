-- Premium Unified 2026
-- Adds:
-- 1) Staging for AT withholding candidates
-- 2) Control Center operational view + RPCs
-- 3) Promotion/review workflow from candidates -> tax_withholdings

-- ---------------------------------------------------------------------------
-- 1) Staging table: at_withholding_candidates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.at_withholding_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sync_history_id uuid REFERENCES public.at_sync_history(id) ON DELETE SET NULL,
  source_sales_invoice_id uuid REFERENCES public.sales_invoices(id) ON DELETE SET NULL,
  fiscal_year integer NOT NULL CHECK (fiscal_year >= 2000),
  payment_date date NOT NULL,
  document_reference text NOT NULL,
  beneficiary_nif text NOT NULL,
  beneficiary_name text,
  income_category text NOT NULL CHECK (income_category IN ('B', 'E', 'F')),
  gross_amount numeric(14,2) NOT NULL CHECK (gross_amount >= 0),
  withholding_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (withholding_amount >= 0),
  withholding_rate numeric(6,3),
  confidence_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  detection_reason text,
  detected_keys text[] NOT NULL DEFAULT '{}',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'promoted', 'rejected')),
  promoted_withholding_id uuid REFERENCES public.tax_withholdings(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_at_withholding_candidates_dedupe
  ON public.at_withholding_candidates (client_id, beneficiary_nif, document_reference, fiscal_year);

CREATE INDEX IF NOT EXISTS idx_at_withholding_candidates_client_status
  ON public.at_withholding_candidates (client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_at_withholding_candidates_confidence
  ON public.at_withholding_candidates (client_id, confidence_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_at_withholding_candidates_sync
  ON public.at_withholding_candidates (sync_history_id, client_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    DROP TRIGGER IF EXISTS trg_at_withholding_candidates_updated_at
      ON public.at_withholding_candidates;

    CREATE TRIGGER trg_at_withholding_candidates_updated_at
    BEFORE UPDATE ON public.at_withholding_candidates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

ALTER TABLE public.at_withholding_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS at_withholding_candidates_select_access
  ON public.at_withholding_candidates;

CREATE POLICY at_withholding_candidates_select_access
  ON public.at_withholding_candidates
  FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.client_accountants ca
      WHERE ca.client_id = at_withholding_candidates.client_id
        AND ca.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

REVOKE ALL ON TABLE public.at_withholding_candidates FROM PUBLIC;
GRANT SELECT ON TABLE public.at_withholding_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.at_withholding_candidates TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Operational view: at_control_center_view
-- ---------------------------------------------------------------------------

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
    count(*) FILTER (WHERE c.status = 'pending' AND c.confidence_score >= 80)::integer AS withholding_candidates_high_confidence,
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
    cred.client_id IS NOT NULL
    AND coalesce(cred.portal_nif, '') <> ''
    AND (
      coalesce(cred.portal_password_encrypted, '') <> ''
      OR coalesce(cred.encrypted_password, '') <> ''
    )
  ) AS has_credentials,
  cred.environment AS credential_environment,
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
    WHEN (
      cred.client_id IS NULL
      OR coalesce(cred.portal_nif, '') = ''
      OR (
        coalesce(cred.portal_password_encrypted, '') = ''
        AND coalesce(cred.encrypted_password, '') = ''
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

-- ---------------------------------------------------------------------------
-- 3) RPC: get_at_control_center (paged/filter/search)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_at_control_center(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  accountant_id uuid,
  client_id uuid,
  client_name text,
  client_email text,
  client_nif text,
  has_credentials boolean,
  credential_environment text,
  last_sync_at timestamptz,
  last_sync_status text,
  last_reason_code text,
  last_error_message text,
  last_sync_method text,
  compras_total integer,
  vendas_total integer,
  withholdings_total integer,
  withholding_candidates_pending integer,
  withholding_candidates_high_confidence integer,
  withholding_candidates_rejected integer,
  jobs_pending integer,
  jobs_processing integer,
  jobs_error integer,
  jobs_completed integer,
  last_job_at timestamptz,
  operational_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean := false;
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 500));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  v_is_admin := coalesce(public.has_role(v_user_id, 'admin'), false);

  RETURN QUERY
  SELECT
    v.accountant_id,
    v.client_id,
    v.client_name,
    v.client_email,
    v.client_nif,
    v.has_credentials,
    v.credential_environment,
    v.last_sync_at,
    v.last_sync_status,
    v.last_reason_code,
    v.last_error_message,
    v.last_sync_method,
    v.compras_total,
    v.vendas_total,
    v.withholdings_total,
    v.withholding_candidates_pending,
    v.withholding_candidates_high_confidence,
    v.withholding_candidates_rejected,
    v.jobs_pending,
    v.jobs_processing,
    v.jobs_error,
    v.jobs_completed,
    v.last_job_at,
    v.operational_status
  FROM public.at_control_center_view v
  WHERE
    (v_is_admin OR v.accountant_id = v_user_id)
    AND (
      p_search IS NULL
      OR p_search = ''
      OR coalesce(v.client_name, '') ILIKE ('%' || p_search || '%')
      OR coalesce(v.client_nif, '') ILIKE ('%' || p_search || '%')
      OR coalesce(v.client_email, '') ILIKE ('%' || p_search || '%')
    )
    AND (
      p_status IS NULL
      OR p_status = ''
      OR v.operational_status = p_status
    )
    AND (
      p_reason IS NULL
      OR p_reason = ''
      OR coalesce(v.last_reason_code, '') = p_reason
    )
  ORDER BY
    CASE v.operational_status
      WHEN 'auth_failed' THEN 1
      WHEN 'error' THEN 2
      WHEN 'no_credentials' THEN 3
      WHEN 'processing' THEN 4
      WHEN 'queued' THEN 5
      WHEN 'partial' THEN 6
      WHEN 'success' THEN 7
      ELSE 8
    END,
    v.last_job_at DESC NULLS LAST,
    v.last_sync_at DESC NULLS LAST
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_at_control_center(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_at_control_center(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_at_control_center(text, text, text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) RPC: get_at_control_center_stats
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_at_control_center_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean := false;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'total_clients', 0,
      'with_credentials', 0,
      'requires_attention', 0,
      'status_counts', '{}'::jsonb,
      'reason_counts', '{}'::jsonb
    );
  END IF;

  v_is_admin := coalesce(public.has_role(v_user_id, 'admin'), false);

  WITH base AS (
    SELECT *
    FROM public.at_control_center_view v
    WHERE (v_is_admin OR v.accountant_id = v_user_id)
  ),
  status_counts AS (
    SELECT operational_status, count(*)::integer AS n
    FROM base
    GROUP BY operational_status
  ),
  reason_counts AS (
    SELECT last_reason_code, count(*)::integer AS n
    FROM base
    WHERE last_reason_code IS NOT NULL
    GROUP BY last_reason_code
  )
  SELECT jsonb_build_object(
    'total_clients', (SELECT count(*)::integer FROM base),
    'with_credentials', (SELECT count(*)::integer FROM base WHERE has_credentials),
    'requires_attention', (
      SELECT count(*)::integer
      FROM base
      WHERE operational_status IN ('auth_failed', 'error', 'no_credentials')
    ),
    'status_counts', coalesce(
      (SELECT jsonb_object_agg(operational_status, n) FROM status_counts),
      '{}'::jsonb
    ),
    'reason_counts', coalesce(
      (SELECT jsonb_object_agg(last_reason_code, n) FROM reason_counts),
      '{}'::jsonb
    )
  )
  INTO v_result;

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_at_control_center_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_at_control_center_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_at_control_center_stats() TO service_role;

-- ---------------------------------------------------------------------------
-- 5) RPC: promote_withholding_candidates
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.promote_withholding_candidates(
  p_client_id uuid,
  p_ids uuid[] DEFAULT NULL,
  p_mode text DEFAULT 'auto'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
  v_is_service_role boolean := v_auth_role = 'service_role';
  v_is_admin boolean := false;
  v_is_accountant_of_client boolean := false;
  v_mode text := lower(coalesce(p_mode, 'auto'));
  v_selected integer := 0;
  v_promoted integer := 0;
  v_rejected integer := 0;
  v_skipped integer := 0;
BEGIN
  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'p_client_id is required';
  END IF;

  IF v_mode NOT IN ('auto', 'manual_approve', 'manual_reject') THEN
    RAISE EXCEPTION 'Invalid p_mode. Allowed: auto, manual_approve, manual_reject';
  END IF;

  IF NOT v_is_service_role THEN
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;

    v_is_admin := coalesce(public.has_role(v_user_id, 'admin'), false);

    SELECT EXISTS (
      SELECT 1
      FROM public.client_accountants ca
      WHERE ca.client_id = p_client_id
        AND ca.accountant_id = v_user_id
    ) INTO v_is_accountant_of_client;

    IF NOT v_is_admin AND NOT v_is_accountant_of_client THEN
      RAISE EXCEPTION 'Forbidden: no access to this client';
    END IF;
  END IF;

  IF v_mode = 'manual_reject' THEN
    UPDATE public.at_withholding_candidates c
    SET
      status = 'rejected',
      reviewed_by = coalesce(v_user_id, reviewed_by),
      reviewed_at = now(),
      notes = coalesce(c.notes, '') || CASE
        WHEN coalesce(c.notes, '') = '' THEN 'Rejected manually'
        ELSE ' | Rejected manually'
      END
    WHERE c.client_id = p_client_id
      AND c.status = 'pending'
      AND (p_ids IS NULL OR c.id = ANY(p_ids));

    GET DIAGNOSTICS v_rejected = ROW_COUNT;

    RETURN jsonb_build_object(
      'success', true,
      'mode', v_mode,
      'selected', v_rejected,
      'promoted', 0,
      'rejected', v_rejected,
      'skipped', 0
    );
  END IF;

  WITH selected AS (
    SELECT c.*
    FROM public.at_withholding_candidates c
    WHERE c.client_id = p_client_id
      AND c.status = 'pending'
      AND (p_ids IS NULL OR c.id = ANY(p_ids))
      AND (
        v_mode <> 'auto'
        OR c.confidence_score >= 80
      )
  ),
  inserted AS (
    INSERT INTO public.tax_withholdings (
      client_id,
      fiscal_year,
      beneficiary_nif,
      beneficiary_name,
      income_category,
      location_code,
      gross_amount,
      exempt_amount,
      dispensed_amount,
      withholding_rate,
      withholding_amount,
      payment_date,
      document_reference,
      source_sales_invoice_id,
      status,
      notes,
      is_non_resident
    )
    SELECT
      s.client_id,
      s.fiscal_year,
      s.beneficiary_nif,
      s.beneficiary_name,
      s.income_category,
      'C',
      s.gross_amount,
      0,
      0,
      s.withholding_rate,
      s.withholding_amount,
      s.payment_date,
      s.document_reference,
      s.source_sales_invoice_id,
      'draft',
      trim(both ';' FROM concat_ws('; ', 'AT candidate promoted', nullif(s.detection_reason, ''))),
      false
    FROM selected s
    ON CONFLICT (beneficiary_nif, document_reference, fiscal_year)
    DO NOTHING
    RETURNING id, beneficiary_nif, document_reference, fiscal_year
  ),
  mark_promoted AS (
    UPDATE public.at_withholding_candidates c
    SET
      status = 'promoted',
      promoted_withholding_id = tw.id,
      reviewed_by = coalesce(v_user_id, reviewed_by),
      reviewed_at = now(),
      updated_at = now()
    FROM selected s
    JOIN public.tax_withholdings tw
      ON tw.client_id = s.client_id
     AND tw.beneficiary_nif = s.beneficiary_nif
     AND tw.document_reference = s.document_reference
     AND tw.fiscal_year = s.fiscal_year
    WHERE c.id = s.id
      AND c.status = 'pending'
    RETURNING c.id
  )
  SELECT
    (SELECT count(*)::integer FROM selected),
    (SELECT count(*)::integer FROM mark_promoted)
  INTO v_selected, v_promoted;

  v_skipped := greatest(v_selected - v_promoted, 0);

  RETURN jsonb_build_object(
    'success', true,
    'mode', v_mode,
    'selected', v_selected,
    'promoted', v_promoted,
    'rejected', 0,
    'skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.promote_withholding_candidates(uuid, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_withholding_candidates(uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_withholding_candidates(uuid, uuid[], text) TO service_role;
