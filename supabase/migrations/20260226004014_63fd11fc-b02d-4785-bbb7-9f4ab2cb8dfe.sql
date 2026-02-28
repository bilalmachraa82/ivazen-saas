-- ============================================================
-- AT Control Center + Withholding Candidates Staging
-- Migration: 20260225153000_add_at_control_center_and_withholding_candidates
-- ============================================================

-- 1) Staging table for withholding candidates
CREATE TABLE IF NOT EXISTS public.at_withholding_candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  accountant_id uuid NOT NULL,
  beneficiary_nif text NOT NULL,
  beneficiary_name text,
  income_category text NOT NULL,
  income_code text,
  gross_amount numeric NOT NULL DEFAULT 0,
  withholding_amount numeric NOT NULL DEFAULT 0,
  withholding_rate numeric,
  payment_date date NOT NULL,
  document_reference text,
  fiscal_year integer NOT NULL,
  confidence numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  promoted_at timestamptz,
  promoted_withholding_id uuid,
  rejection_reason text,
  source_sync_history_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_at_wc_client_status ON public.at_withholding_candidates (client_id, status);

-- accountant_id may not exist yet if the table was created by an earlier migration
-- with a different schema. The consolidation migration adds it later.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'at_withholding_candidates'
      AND column_name = 'accountant_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_at_wc_accountant ON public.at_withholding_candidates (accountant_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_at_wc_fiscal_year ON public.at_withholding_candidates (fiscal_year);
CREATE UNIQUE INDEX IF NOT EXISTS idx_at_wc_dedupe 
  ON public.at_withholding_candidates (client_id, beneficiary_nif, document_reference, fiscal_year)
  WHERE document_reference IS NOT NULL;

-- RLS
ALTER TABLE public.at_withholding_candidates ENABLE ROW LEVEL SECURITY;

-- This policy references accountant_id column which may not exist yet.
-- Wrap in conditional to skip if column is missing (consolidation migration adds it).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'at_withholding_candidates'
      AND column_name = 'accountant_id'
  ) THEN
    DROP POLICY IF EXISTS "Accountants can view own client candidates" ON public.at_withholding_candidates;
    CREATE POLICY "Accountants can view own client candidates"
      ON public.at_withholding_candidates FOR SELECT
      USING (
        accountant_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.client_accountants ca
          WHERE ca.client_id = at_withholding_candidates.client_id
            AND ca.accountant_id = auth.uid()
        )
      );
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins can view all candidates" ON public.at_withholding_candidates;
CREATE POLICY "Admins can view all candidates"
  ON public.at_withholding_candidates FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- service_role gets full access by default (bypasses RLS)
-- authenticated only gets SELECT via policies above

-- Grants
GRANT SELECT ON public.at_withholding_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.at_withholding_candidates TO service_role;

-- Updated_at trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS update_at_withholding_candidates_updated_at ON public.at_withholding_candidates;
CREATE TRIGGER update_at_withholding_candidates_updated_at
  BEFORE UPDATE ON public.at_withholding_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) AT Control Center view + dependent RPC functions
-- These reference 'confidence' column on at_withholding_candidates which may not exist
-- if the table was created by an earlier migration with a different schema.
-- The consolidation migration (20260226021000) adds the column and recreates the view.
-- Skip here if column is missing to avoid failure.
DO $view_and_rpcs$ BEGIN
  -- Only create view and dependent functions if at_withholding_candidates has the confidence column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'at_withholding_candidates'
      AND column_name = 'confidence'
  ) THEN
    RAISE NOTICE 'Skipping at_control_center_view and dependent RPCs: confidence column not yet present on at_withholding_candidates. The consolidation migration will create them.';
    RETURN;
  END IF;

  -- Create the view
  EXECUTE $sql$
    CREATE OR REPLACE VIEW public.at_control_center_view AS
    SELECT
      ca.accountant_id,
      ca.client_id,
      p.full_name AS client_name,
      p.email AS client_email,
      p.nif AS client_nif,
      CASE WHEN cred.id IS NOT NULL THEN true ELSE false END AS has_credentials,
      cred.environment AS credential_environment,
      cred.last_sync_at,
      cred.last_sync_status,
      h.reason_code AS last_reason_code,
      h.error_message AS last_error_message,
      h.sync_method AS last_sync_method,
      COALESCE((SELECT count(*) FROM public.invoices i WHERE i.client_id = ca.client_id), 0)::int AS compras_total,
      COALESCE((SELECT count(*) FROM public.sales_invoices si WHERE si.client_id = ca.client_id), 0)::int AS vendas_total,
      COALESCE((SELECT count(*) FROM public.tax_withholdings tw WHERE tw.client_id = ca.client_id), 0)::int AS withholdings_total,
      COALESCE((SELECT count(*) FROM public.at_withholding_candidates wc WHERE wc.client_id = ca.client_id AND wc.status = 'pending'), 0)::int AS withholding_candidates_pending,
      COALESCE((SELECT count(*) FROM public.at_withholding_candidates wc WHERE wc.client_id = ca.client_id AND wc.confidence >= 80), 0)::int AS withholding_candidates_high_confidence,
      COALESCE((SELECT count(*) FROM public.at_withholding_candidates wc WHERE wc.client_id = ca.client_id AND wc.status = 'rejected'), 0)::int AS withholding_candidates_rejected,
      COALESCE((SELECT count(*) FROM public.at_sync_jobs j WHERE j.client_id = ca.client_id AND j.status = 'pending'), 0)::int AS jobs_pending,
      COALESCE((SELECT count(*) FROM public.at_sync_jobs j WHERE j.client_id = ca.client_id AND j.status = 'processing'), 0)::int AS jobs_processing,
      COALESCE((SELECT count(*) FROM public.at_sync_jobs j WHERE j.client_id = ca.client_id AND j.status = 'error'), 0)::int AS jobs_error,
      COALESCE((SELECT count(*) FROM public.at_sync_jobs j WHERE j.client_id = ca.client_id AND j.status = 'completed'), 0)::int AS jobs_completed,
      (SELECT max(j.created_at) FROM public.at_sync_jobs j WHERE j.client_id = ca.client_id) AS last_job_at,
      CASE
        WHEN cred.id IS NULL THEN 'no_credentials'
        WHEN cred.last_sync_status = 'error' AND h.reason_code = 'AT_AUTH_FAILED' THEN 'auth_failed'
        WHEN cred.last_sync_status = 'error' THEN 'error'
        WHEN EXISTS (SELECT 1 FROM public.at_sync_jobs j WHERE j.client_id = ca.client_id AND j.status = 'processing') THEN 'processing'
        WHEN EXISTS (SELECT 1 FROM public.at_sync_jobs j WHERE j.client_id = ca.client_id AND j.status = 'pending') THEN 'queued'
        WHEN cred.last_sync_status = 'partial' THEN 'partial'
        WHEN cred.last_sync_status = 'success' THEN 'success'
        ELSE 'never'
      END AS operational_status
    FROM public.client_accountants ca
    JOIN public.profiles p ON p.id = ca.client_id
    LEFT JOIN public.at_credentials cred ON cred.client_id = ca.client_id AND cred.accountant_id = ca.accountant_id
    LEFT JOIN LATERAL (
      SELECT sh.reason_code, sh.error_message, sh.sync_method
      FROM public.at_sync_history sh
      WHERE sh.client_id = ca.client_id
      ORDER BY sh.created_at DESC
      LIMIT 1
    ) h ON true
  $sql$;

  -- 3) RPC: get_at_control_center
  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION public.get_at_control_center(
      p_search text DEFAULT NULL,
      p_status text DEFAULT NULL,
      p_reason text DEFAULT NULL,
      p_limit integer DEFAULT 50,
      p_offset integer DEFAULT 0
    )
    RETURNS SETOF public.at_control_center_view
    LANGUAGE sql
    STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $fn$
      SELECT *
      FROM public.at_control_center_view v
      WHERE v.accountant_id = auth.uid()
        AND (p_search IS NULL OR p_search = '' OR
             v.client_name ILIKE '%' || p_search || '%' OR
             v.client_nif ILIKE '%' || p_search || '%' OR
             v.client_email ILIKE '%' || p_search || '%')
        AND (p_status IS NULL OR p_status = '' OR v.operational_status = p_status)
        AND (p_reason IS NULL OR p_reason = '' OR v.last_reason_code = p_reason)
      ORDER BY
        CASE v.operational_status
          WHEN 'auth_failed' THEN 0
          WHEN 'error' THEN 1
          WHEN 'no_credentials' THEN 2
          WHEN 'processing' THEN 3
          WHEN 'queued' THEN 4
          WHEN 'partial' THEN 5
          WHEN 'never' THEN 6
          WHEN 'success' THEN 7
          ELSE 8
        END,
        v.last_sync_at DESC NULLS LAST
      LIMIT p_limit
      OFFSET p_offset;
    $fn$
  $sql$;

  -- 4) RPC: get_at_control_center_stats
  EXECUTE $sql$
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
        'reason_counts', '{}'::jsonb
      )
      INTO v_result
      FROM (
        SELECT operational_status, has_credentials, count(*) OVER (PARTITION BY operational_status) AS cnt
        FROM public.at_control_center_view
        WHERE accountant_id = auth.uid()
      ) sub;

      -- Add reason_counts separately
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

      RETURN COALESCE(v_result, jsonb_build_object(
        'total_clients', 0,
        'with_credentials', 0,
        'requires_attention', 0,
        'status_counts', '{}'::jsonb,
        'reason_counts', '{}'::jsonb
      ));
    END;
    $fn$
  $sql$;

END $view_and_rpcs$;

-- 5) RPC: promote_withholding_candidates
CREATE OR REPLACE FUNCTION public.promote_withholding_candidates(
  p_client_id uuid,
  p_ids uuid[] DEFAULT NULL,
  p_mode text DEFAULT 'manual_approve'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_promoted integer := 0;
  v_rejected integer := 0;
  v_skipped integer := 0;
  v_selected integer := 0;
  v_accountant_id uuid := auth.uid();
  v_candidate RECORD;
  v_new_withholding_id uuid;
BEGIN
  -- Verify accountant has access
  IF NOT EXISTS (
    SELECT 1 FROM public.client_accountants ca
    WHERE ca.client_id = p_client_id
      AND ca.accountant_id = v_accountant_id
      AND ca.access_level = 'full'
  ) THEN
    RAISE EXCEPTION 'Access denied: not authorized for this client';
  END IF;

  -- Handle rejection mode
  IF p_mode = 'manual_reject' THEN
    UPDATE public.at_withholding_candidates
    SET status = 'rejected',
        rejection_reason = 'Manual rejection by accountant',
        updated_at = now()
    WHERE client_id = p_client_id
      AND status = 'pending'
      AND (p_ids IS NULL OR id = ANY(p_ids));
    GET DIAGNOSTICS v_rejected = ROW_COUNT;

    RETURN jsonb_build_object(
      'promoted', 0,
      'rejected', v_rejected,
      'skipped', 0,
      'selected', v_rejected
    );
  END IF;

  -- Approve mode: promote pending candidates to tax_withholdings
  FOR v_candidate IN
    SELECT *
    FROM public.at_withholding_candidates
    WHERE client_id = p_client_id
      AND status = 'pending'
      AND (p_ids IS NULL OR id = ANY(p_ids))
    ORDER BY payment_date
  LOOP
    v_selected := v_selected + 1;

    -- Check for duplicate in tax_withholdings
    IF EXISTS (
      SELECT 1 FROM public.tax_withholdings tw
      WHERE tw.client_id = p_client_id
        AND tw.beneficiary_nif = v_candidate.beneficiary_nif
        AND tw.document_reference = v_candidate.document_reference
        AND tw.fiscal_year = v_candidate.fiscal_year
        AND v_candidate.document_reference IS NOT NULL
    ) THEN
      UPDATE public.at_withholding_candidates
      SET status = 'skipped',
          notes = COALESCE(notes, '') || ' | Duplicate in tax_withholdings',
          updated_at = now()
      WHERE id = v_candidate.id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Insert into tax_withholdings
    INSERT INTO public.tax_withholdings (
      client_id, beneficiary_nif, beneficiary_name, income_category,
      income_code, gross_amount, withholding_amount, withholding_rate,
      payment_date, document_reference, fiscal_year, status, notes
    ) VALUES (
      p_client_id, v_candidate.beneficiary_nif, v_candidate.beneficiary_name,
      v_candidate.income_category, v_candidate.income_code,
      v_candidate.gross_amount, v_candidate.withholding_amount,
      v_candidate.withholding_rate, v_candidate.payment_date,
      v_candidate.document_reference, v_candidate.fiscal_year,
      'draft',
      'Promoted from AT staging candidate ' || v_candidate.id::text
    )
    RETURNING id INTO v_new_withholding_id;

    -- Mark candidate as promoted
    UPDATE public.at_withholding_candidates
    SET status = 'promoted',
        promoted_at = now(),
        promoted_withholding_id = v_new_withholding_id,
        updated_at = now()
    WHERE id = v_candidate.id;

    v_promoted := v_promoted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'promoted', v_promoted,
    'rejected', v_rejected,
    'skipped', v_skipped,
    'selected', v_selected
  );
END;
$$;
