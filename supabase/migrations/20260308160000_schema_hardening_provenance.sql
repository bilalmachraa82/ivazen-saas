-- Schema hardening: fiscal provenance and import source tracking
-- Replaces regex bridges in notes with proper auditable columns.
-- Safe for existing data: all new columns are nullable with backfill.

-- ─────────────────────────────────────────────────────────────────
-- 1. sales_invoices: withholding_amount_imported + import_source
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS withholding_amount_imported NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS import_source TEXT DEFAULT NULL;

COMMENT ON COLUMN public.sales_invoices.withholding_amount_imported IS
  'Explicit withholding amount from AT SIRE CSV or other import source. Replaces AT_SIRE_WITHHOLDING= regex in notes.';

COMMENT ON COLUMN public.sales_invoices.import_source IS
  'How this record entered the system: at_sire, saft, recibos_verdes_excel, csv, manual, api';

-- Backfill withholding_amount_imported from notes regex
UPDATE public.sales_invoices
SET withholding_amount_imported = (
  regexp_match(notes, 'AT_SIRE_WITHHOLDING=([0-9]+(?:\.[0-9]+)?)')
)[1]::numeric
WHERE notes LIKE '%AT_SIRE_WITHHOLDING=%'
  AND withholding_amount_imported IS NULL;

-- Backfill import_source from notes text patterns
UPDATE public.sales_invoices
SET import_source = CASE
  WHEN notes LIKE '%Faturas e Recibos AT (CSV)%' THEN 'at_sire'
  WHEN notes LIKE '%Recibos Verdes (Excel AT)%' THEN 'recibos_verdes_excel'
  WHEN notes LIKE '%SAF-T%' THEN 'saft'
  ELSE NULL
END
WHERE import_source IS NULL
  AND notes IS NOT NULL;

-- Partial indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_sales_invoices_import_source
  ON public.sales_invoices(import_source) WHERE import_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_withholding_imported
  ON public.sales_invoices(withholding_amount_imported) WHERE withholding_amount_imported IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- 2. tax_withholdings: payer_nif + withholding_reason_text + import_source
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.tax_withholdings
  ADD COLUMN IF NOT EXISTS payer_nif TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS withholding_reason_text TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS import_source TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS withholding_semantic_status TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tax_withholdings_withholding_semantic_status_check'
  ) THEN
    ALTER TABLE public.tax_withholdings
      ADD CONSTRAINT tax_withholdings_withholding_semantic_status_check
      CHECK (
        withholding_semantic_status IS NULL
        OR withholding_semantic_status IN (
          'no_withholding_legal',
          'withholding_expected',
          'unknown'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.tax_withholdings.payer_nif IS
  'NIF of the entity that paid and withheld tax. NULL when payer = client (most Modelo 10 cases).';

COMMENT ON COLUMN public.tax_withholdings.withholding_reason_text IS
  'Legal basis or description for the withholding (e.g. Art. 101.º CIRS - Trabalho independente).';

COMMENT ON COLUMN public.tax_withholdings.import_source IS
  'How this record entered the system: at_sire_detection, ocr, csv, manual, bulk_upload, email, at_csv';

COMMENT ON COLUMN public.tax_withholdings.withholding_semantic_status IS
  'OCR/AI semantic status: no_withholding_legal (doc states exemption), withholding_expected (rate>0 but amount missing), unknown. Distinct from workflow status (draft/included/submitted).';

-- Partial indexes
CREATE INDEX IF NOT EXISTS idx_tax_withholdings_payer_nif
  ON public.tax_withholdings(payer_nif) WHERE payer_nif IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tax_withholdings_import_source
  ON public.tax_withholdings(import_source) WHERE import_source IS NOT NULL;

-- Backfill import_source for existing tax_withholdings from notes patterns
UPDATE public.tax_withholdings
SET import_source = CASE
  WHEN notes LIKE '%AT candidate promoted%' THEN 'at_sire_detection'
  WHEN notes LIKE '%Importado de email%' THEN 'email'
  ELSE NULL
END
WHERE import_source IS NULL
  AND notes IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- 3. Update promote_withholding_candidates to set import_source
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.promote_withholding_candidates(
  p_client_id uuid, p_ids uuid[] DEFAULT NULL, p_mode text DEFAULT 'manual_approve'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_user_id uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
  v_is_service_role boolean := (v_auth_role = 'service_role');
  v_is_admin boolean := false;
  v_is_accountant_of_client boolean := false;
  v_mode text := lower(coalesce(p_mode, 'manual_approve'));
  v_selected integer := 0; v_promoted integer := 0; v_rejected integer := 0; v_skipped integer := 0;
  v_candidate record; v_withholding_id uuid;
BEGIN
  IF p_client_id IS NULL THEN RAISE EXCEPTION 'p_client_id is required'; END IF;
  IF v_mode NOT IN ('auto', 'manual_approve', 'manual_reject') THEN RAISE EXCEPTION 'Invalid p_mode'; END IF;

  IF NOT v_is_service_role THEN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    v_is_admin := coalesce(public.has_role(v_user_id, 'admin'), false);
    SELECT EXISTS (SELECT 1 FROM public.client_accountants ca WHERE ca.client_id = p_client_id AND ca.accountant_id = v_user_id) INTO v_is_accountant_of_client;
    IF NOT v_is_admin AND NOT v_is_accountant_of_client THEN RAISE EXCEPTION 'Forbidden'; END IF;
  END IF;

  IF v_mode = 'manual_reject' THEN
    UPDATE public.at_withholding_candidates c SET status='rejected', rejection_reason=coalesce(c.rejection_reason,'Rejected manually'), reviewed_by=coalesce(v_user_id,c.reviewed_by), reviewed_at=now(), updated_at=now()
    WHERE c.client_id=p_client_id AND c.status='pending' AND (p_ids IS NULL OR c.id=ANY(p_ids));
    GET DIAGNOSTICS v_rejected = ROW_COUNT;
    RETURN jsonb_build_object('success',true,'mode',v_mode,'selected',v_rejected,'promoted',0,'rejected',v_rejected,'skipped',0);
  END IF;

  FOR v_candidate IN
    SELECT c.* FROM public.at_withholding_candidates c
    WHERE c.client_id=p_client_id AND c.status='pending' AND (p_ids IS NULL OR c.id=ANY(p_ids))
      AND (v_mode<>'auto' OR coalesce(c.confidence_score,c.confidence,0)>=80)
    ORDER BY c.payment_date ASC, c.created_at ASC, c.id ASC
  LOOP
    v_selected := v_selected + 1;
    SELECT tw.id INTO v_withholding_id FROM public.tax_withholdings tw
    WHERE tw.client_id=p_client_id AND tw.beneficiary_nif=v_candidate.beneficiary_nif AND tw.document_reference=v_candidate.document_reference AND tw.fiscal_year=v_candidate.fiscal_year AND v_candidate.document_reference IS NOT NULL LIMIT 1;

    IF v_withholding_id IS NOT NULL THEN
      UPDATE public.at_withholding_candidates SET status='skipped', promoted_withholding_id=v_withholding_id, reviewed_by=coalesce(v_user_id,reviewed_by), reviewed_at=now(), updated_at=now(), notes=trim(both ' ' FROM concat_ws(' | ',notes,'Skipped: duplicate')) WHERE id=v_candidate.id;
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;

    v_withholding_id := NULL;
    INSERT INTO public.tax_withholdings (client_id,fiscal_year,beneficiary_nif,beneficiary_name,income_category,income_code,location_code,gross_amount,exempt_amount,dispensed_amount,withholding_rate,withholding_amount,payment_date,document_reference,source_sales_invoice_id,status,notes,is_non_resident,import_source)
    VALUES (v_candidate.client_id,v_candidate.fiscal_year,v_candidate.beneficiary_nif,v_candidate.beneficiary_name,v_candidate.income_category,v_candidate.income_code,'C',coalesce(v_candidate.gross_amount,0),0,0,v_candidate.withholding_rate,coalesce(v_candidate.withholding_amount,0),v_candidate.payment_date,v_candidate.document_reference,v_candidate.source_sales_invoice_id,'draft',trim(both ' ' FROM concat_ws(' | ','AT candidate promoted',nullif(v_candidate.detection_reason,'')))
,false,'at_sire_detection')
    ON CONFLICT (beneficiary_nif, document_reference, fiscal_year) DO NOTHING
    RETURNING id INTO v_withholding_id;

    IF v_withholding_id IS NULL THEN
      SELECT tw.id INTO v_withholding_id FROM public.tax_withholdings tw WHERE tw.client_id=p_client_id AND tw.beneficiary_nif=v_candidate.beneficiary_nif AND tw.document_reference=v_candidate.document_reference AND tw.fiscal_year=v_candidate.fiscal_year AND v_candidate.document_reference IS NOT NULL LIMIT 1;
      UPDATE public.at_withholding_candidates SET status='skipped', promoted_withholding_id=v_withholding_id, reviewed_by=coalesce(v_user_id,reviewed_by), reviewed_at=now(), updated_at=now(), notes=trim(both ' ' FROM concat_ws(' | ',notes,'Skipped: conflict')) WHERE id=v_candidate.id;
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;

    UPDATE public.at_withholding_candidates SET status='promoted', promoted_withholding_id=v_withholding_id, promoted_at=now(), reviewed_by=coalesce(v_user_id,reviewed_by), reviewed_at=now(), updated_at=now() WHERE id=v_candidate.id;
    v_promoted := v_promoted + 1;
  END LOOP;

  RETURN jsonb_build_object('success',true,'mode',v_mode,'selected',v_selected,'promoted',v_promoted,'rejected',v_rejected,'skipped',v_skipped);
END;
$fn$;

REVOKE ALL ON FUNCTION public.promote_withholding_candidates(uuid, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_withholding_candidates(uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_withholding_candidates(uuid, uuid[], text) TO service_role;
