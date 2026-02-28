-- Consolidate at_withholding_candidates schema drift across AT Control Center migrations
-- Goal: keep a superset schema compatible with both historical implementations.

DO $$
BEGIN
  IF to_regclass('public.at_withholding_candidates') IS NULL THEN
    RAISE EXCEPTION 'Table public.at_withholding_candidates does not exist. Apply AT Control Center base migration first.';
  END IF;
END $$;

ALTER TABLE public.at_withholding_candidates
  ADD COLUMN IF NOT EXISTS accountant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sync_history_id uuid REFERENCES public.at_sync_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_sync_history_id uuid REFERENCES public.at_sync_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_sales_invoice_id uuid REFERENCES public.sales_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confidence_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS confidence numeric(5,2),
  ADD COLUMN IF NOT EXISTS detection_reason text,
  ADD COLUMN IF NOT EXISTS detected_keys text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS raw_payload jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.at_withholding_candidates
SET confidence_score = confidence
WHERE confidence_score IS NULL
  AND confidence IS NOT NULL;

UPDATE public.at_withholding_candidates
SET confidence = confidence_score
WHERE confidence IS NULL
  AND confidence_score IS NOT NULL;

UPDATE public.at_withholding_candidates
SET confidence_score = 0
WHERE confidence_score IS NULL;

UPDATE public.at_withholding_candidates
SET confidence = confidence_score
WHERE confidence IS NULL;

UPDATE public.at_withholding_candidates
SET sync_history_id = source_sync_history_id
WHERE sync_history_id IS NULL
  AND source_sync_history_id IS NOT NULL;

UPDATE public.at_withholding_candidates
SET source_sync_history_id = sync_history_id
WHERE source_sync_history_id IS NULL
  AND sync_history_id IS NOT NULL;

UPDATE public.at_withholding_candidates
SET detected_keys = '{}'::text[]
WHERE detected_keys IS NULL;

UPDATE public.at_withholding_candidates
SET raw_payload = '{}'::jsonb
WHERE raw_payload IS NULL;

-- Fill accountant_id from credential owner first, then fallback to any linked accountant.
UPDATE public.at_withholding_candidates c
SET accountant_id = cred.accountant_id
FROM public.at_credentials cred
WHERE c.accountant_id IS NULL
  AND cred.client_id = c.client_id
  AND cred.accountant_id IS NOT NULL;

WITH ranked AS (
  SELECT
    ca.client_id,
    ca.accountant_id,
    row_number() OVER (PARTITION BY ca.client_id ORDER BY ca.created_at DESC NULLS LAST, ca.accountant_id) AS rn
  FROM public.client_accountants ca
)
UPDATE public.at_withholding_candidates c
SET accountant_id = r.accountant_id
FROM ranked r
WHERE c.accountant_id IS NULL
  AND c.client_id = r.client_id
  AND r.rn = 1;

UPDATE public.at_withholding_candidates
SET status = 'pending'
WHERE status IS NULL
   OR btrim(status) = '';

UPDATE public.at_withholding_candidates
SET status = 'skipped',
    notes = trim(both ' ' FROM concat_ws(' | ', notes, 'Status normalized during consolidation'))
WHERE status NOT IN ('pending', 'promoted', 'rejected', 'skipped');

-- Remove duplicate candidates to enforce deterministic unique dedupe index.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY client_id, beneficiary_nif, document_reference, fiscal_year
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.at_withholding_candidates
  WHERE document_reference IS NOT NULL
)
DELETE FROM public.at_withholding_candidates c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- Replace any prior status check with canonical status set.
DO $$
DECLARE
  v_conname text;
BEGIN
  FOR v_conname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.at_withholding_candidates'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.at_withholding_candidates DROP CONSTRAINT IF EXISTS %I', v_conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.at_withholding_candidates'::regclass
      AND conname = 'at_withholding_candidates_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.at_withholding_candidates
      ADD CONSTRAINT at_withholding_candidates_status_check
      CHECK (status IN ('pending', 'promoted', 'rejected', 'skipped'))
    $sql$;
  END IF;
END $$;

ALTER TABLE public.at_withholding_candidates
  ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_at_withholding_candidates_client_status
  ON public.at_withholding_candidates (client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_at_withholding_candidates_confidence
  ON public.at_withholding_candidates (client_id, confidence_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_at_withholding_candidates_sync
  ON public.at_withholding_candidates (sync_history_id, client_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'at_withholding_candidates'
      AND indexdef ILIKE 'create unique index%on public.at_withholding_candidates% (client_id, beneficiary_nif, document_reference, fiscal_year)%'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uq_at_withholding_candidates_dedupe_unified ON public.at_withholding_candidates (client_id, beneficiary_nif, document_reference, fiscal_year)';
  END IF;
END $$;

ALTER TABLE public.at_withholding_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS at_withholding_candidates_select_access ON public.at_withholding_candidates;
DROP POLICY IF EXISTS "Accountants can view own client candidates" ON public.at_withholding_candidates;
DROP POLICY IF EXISTS "Admins can view all candidates" ON public.at_withholding_candidates;

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
    DROP TRIGGER IF EXISTS update_at_withholding_candidates_updated_at
      ON public.at_withholding_candidates;

    CREATE TRIGGER trg_at_withholding_candidates_updated_at
    BEFORE UPDATE ON public.at_withholding_candidates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER VIEW public.at_control_center_view SET (security_invoker = true)';
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'Could not set security_invoker on at_control_center_view: %', SQLERRM;
  END;
END $$;

REVOKE ALL ON public.at_control_center_view FROM PUBLIC;
GRANT SELECT ON public.at_control_center_view TO service_role;

CREATE OR REPLACE FUNCTION public.promote_withholding_candidates(
  p_client_id uuid,
  p_ids uuid[] DEFAULT NULL,
  p_mode text DEFAULT 'manual_approve'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
  v_is_service_role boolean := (v_auth_role = 'service_role');
  v_is_admin boolean := false;
  v_is_accountant_of_client boolean := false;
  v_mode text := lower(coalesce(p_mode, 'manual_approve'));
  v_selected integer := 0;
  v_promoted integer := 0;
  v_rejected integer := 0;
  v_skipped integer := 0;
  v_candidate record;
  v_withholding_id uuid;
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
      rejection_reason = coalesce(c.rejection_reason, 'Rejected manually'),
      reviewed_by = coalesce(v_user_id, c.reviewed_by),
      reviewed_at = now(),
      updated_at = now(),
      notes = trim(both ' ' FROM concat_ws(' | ', c.notes, 'Rejected manually'))
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

  FOR v_candidate IN
    SELECT c.*
    FROM public.at_withholding_candidates c
    WHERE c.client_id = p_client_id
      AND c.status = 'pending'
      AND (p_ids IS NULL OR c.id = ANY(p_ids))
      AND (
        v_mode <> 'auto'
        OR coalesce(c.confidence_score, c.confidence, 0) >= 80
      )
    ORDER BY c.payment_date ASC, c.created_at ASC, c.id ASC
  LOOP
    v_selected := v_selected + 1;

    SELECT tw.id
    INTO v_withholding_id
    FROM public.tax_withholdings tw
    WHERE tw.client_id = p_client_id
      AND tw.beneficiary_nif = v_candidate.beneficiary_nif
      AND tw.document_reference = v_candidate.document_reference
      AND tw.fiscal_year = v_candidate.fiscal_year
      AND v_candidate.document_reference IS NOT NULL
    LIMIT 1;

    IF v_withholding_id IS NOT NULL THEN
      UPDATE public.at_withholding_candidates
      SET
        status = 'skipped',
        promoted_withholding_id = v_withholding_id,
        reviewed_by = coalesce(v_user_id, reviewed_by),
        reviewed_at = now(),
        updated_at = now(),
        notes = trim(both ' ' FROM concat_ws(' | ', notes, 'Skipped: duplicate in tax_withholdings'))
      WHERE id = v_candidate.id;

      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_withholding_id := NULL;

    INSERT INTO public.tax_withholdings (
      client_id,
      fiscal_year,
      beneficiary_nif,
      beneficiary_name,
      income_category,
      income_code,
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
    VALUES (
      v_candidate.client_id,
      v_candidate.fiscal_year,
      v_candidate.beneficiary_nif,
      v_candidate.beneficiary_name,
      v_candidate.income_category,
      v_candidate.income_code,
      'C',
      coalesce(v_candidate.gross_amount, 0),
      0,
      0,
      v_candidate.withholding_rate,
      coalesce(v_candidate.withholding_amount, 0),
      v_candidate.payment_date,
      v_candidate.document_reference,
      v_candidate.source_sales_invoice_id,
      'draft',
      trim(both ' ' FROM concat_ws(' | ', 'AT candidate promoted', nullif(v_candidate.detection_reason, ''))),
      false
    )
    ON CONFLICT (beneficiary_nif, document_reference, fiscal_year)
    DO NOTHING
    RETURNING id INTO v_withholding_id;

    IF v_withholding_id IS NULL THEN
      SELECT tw.id
      INTO v_withholding_id
      FROM public.tax_withholdings tw
      WHERE tw.client_id = p_client_id
        AND tw.beneficiary_nif = v_candidate.beneficiary_nif
        AND tw.document_reference = v_candidate.document_reference
        AND tw.fiscal_year = v_candidate.fiscal_year
        AND v_candidate.document_reference IS NOT NULL
      LIMIT 1;

      UPDATE public.at_withholding_candidates
      SET
        status = 'skipped',
        promoted_withholding_id = v_withholding_id,
        reviewed_by = coalesce(v_user_id, reviewed_by),
        reviewed_at = now(),
        updated_at = now(),
        notes = trim(both ' ' FROM concat_ws(' | ', notes, 'Skipped: conflict while promoting'))
      WHERE id = v_candidate.id;

      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    UPDATE public.at_withholding_candidates
    SET
      status = 'promoted',
      promoted_withholding_id = v_withholding_id,
      promoted_at = now(),
      reviewed_by = coalesce(v_user_id, reviewed_by),
      reviewed_at = now(),
      updated_at = now()
    WHERE id = v_candidate.id;

    v_promoted := v_promoted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'mode', v_mode,
    'selected', v_selected,
    'promoted', v_promoted,
    'rejected', v_rejected,
    'skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.promote_withholding_candidates(uuid, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_withholding_candidates(uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_withholding_candidates(uuid, uuid[], text) TO service_role;
