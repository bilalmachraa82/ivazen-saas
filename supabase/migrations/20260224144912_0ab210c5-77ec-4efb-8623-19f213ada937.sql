-- Fase 2 (Recibos Verdes/Rendas): sincronizar retenções AT em revenue_entries
-- Objetivo:
-- 1) Não mexer no fluxo compras/vendas (invoices/sales_invoices)
-- 2) Tornar retenções importadas (tax_withholdings) utilizáveis no cálculo de SS
-- 3) Manter idempotência por source_withholding_id

-- 1) Vínculo técnico entre revenue_entries e tax_withholdings
ALTER TABLE public.revenue_entries
ADD COLUMN IF NOT EXISTS source_withholding_id uuid
REFERENCES public.tax_withholdings(id) ON DELETE CASCADE;

DO $$
BEGIN
  ALTER TABLE public.revenue_entries
  ADD CONSTRAINT revenue_entries_source_withholding_id_key UNIQUE (source_withholding_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_revenue_entries_source_withholding_id
  ON public.revenue_entries(source_withholding_id)
  WHERE source_withholding_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_revenue_entries_client_period_source
  ON public.revenue_entries(client_id, period_quarter, source);

COMMENT ON COLUMN public.revenue_entries.source_withholding_id IS
'Link técnico para manter revenue_entries sincronizado com tax_withholdings (AT recibos/rendas).';

-- 2) Mapeamento controlado para categorias de SS existentes
CREATE OR REPLACE FUNCTION public.map_withholding_income_to_revenue_category(p_income_category text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_income_category
    WHEN 'B' THEN 'prestacao_servicos'
    WHEN 'F' THEN 'rendas'
    WHEN 'E' THEN 'capitais'
    ELSE 'outros'
  END;
$$;

COMMENT ON FUNCTION public.map_withholding_income_to_revenue_category(text) IS
'Mapeia categoria de rendimento AT (Modelo 10) para categoria usada em revenue_entries.';

-- 3) Sync unitário (idempotente)
CREATE OR REPLACE FUNCTION public.sync_revenue_entry_from_withholding(p_withholding_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_period_quarter text;
  v_category text;
  v_notes text;
BEGIN
  SELECT
    w.id,
    w.client_id,
    w.income_category,
    w.gross_amount,
    w.payment_date,
    w.document_reference,
    w.source_sales_invoice_id
  INTO v_row
  FROM public.tax_withholdings w
  WHERE w.id = p_withholding_id;

  IF NOT FOUND THEN
    DELETE FROM public.revenue_entries
    WHERE source_withholding_id = p_withholding_id;
    RETURN;
  END IF;

  IF v_row.income_category NOT IN ('B', 'F', 'E')
    OR COALESCE(v_row.gross_amount, 0) <= 0
    OR v_row.source_sales_invoice_id IS NOT NULL
  THEN
    DELETE FROM public.revenue_entries
    WHERE source_withholding_id = v_row.id;
    RETURN;
  END IF;

  v_period_quarter := to_char(v_row.payment_date, 'YYYY') || '-Q' || extract(quarter FROM v_row.payment_date)::int;
  v_category := public.map_withholding_income_to_revenue_category(v_row.income_category);
  v_notes := CONCAT(
    'Auto-sync from AT withholding ',
    COALESCE(v_row.document_reference, v_row.id::text)
  );

  INSERT INTO public.revenue_entries (
    client_id,
    period_quarter,
    category,
    amount,
    source,
    notes,
    source_withholding_id
  )
  VALUES (
    v_row.client_id,
    v_period_quarter,
    v_category,
    v_row.gross_amount,
    'at_withholding_sync',
    v_notes,
    v_row.id
  )
  ON CONFLICT (source_withholding_id)
  DO UPDATE SET
    client_id = EXCLUDED.client_id,
    period_quarter = EXCLUDED.period_quarter,
    category = EXCLUDED.category,
    amount = EXCLUDED.amount,
    source = EXCLUDED.source,
    notes = EXCLUDED.notes,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) IS
'Sincroniza 1 registo de tax_withholdings para revenue_entries (idempotente via source_withholding_id).';

-- 4) Sync em lote para backfill/manual recovery
CREATE OR REPLACE FUNCTION public.sync_revenue_entries_from_withholdings(
  p_client_id uuid DEFAULT NULL,
  p_fiscal_year integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH src AS (
    SELECT
      w.id AS source_withholding_id,
      w.client_id,
      to_char(w.payment_date, 'YYYY') || '-Q' || extract(quarter FROM w.payment_date)::int AS period_quarter,
      public.map_withholding_income_to_revenue_category(w.income_category) AS category,
      w.gross_amount AS amount,
      CONCAT('Auto-sync from AT withholding ', COALESCE(w.document_reference, w.id::text)) AS notes
    FROM public.tax_withholdings w
    WHERE w.income_category IN ('B', 'F', 'E')
      AND COALESCE(w.gross_amount, 0) > 0
      AND w.source_sales_invoice_id IS NULL
      AND (p_client_id IS NULL OR w.client_id = p_client_id)
      AND (p_fiscal_year IS NULL OR w.fiscal_year = p_fiscal_year)
  ),
  upserted AS (
    INSERT INTO public.revenue_entries (
      client_id,
      period_quarter,
      category,
      amount,
      source,
      notes,
      source_withholding_id
    )
    SELECT
      s.client_id,
      s.period_quarter,
      s.category,
      s.amount,
      'at_withholding_sync',
      s.notes,
      s.source_withholding_id
    FROM src s
    ON CONFLICT (source_withholding_id)
    DO UPDATE SET
      client_id = EXCLUDED.client_id,
      period_quarter = EXCLUDED.period_quarter,
      category = EXCLUDED.category,
      amount = EXCLUDED.amount,
      source = EXCLUDED.source,
      notes = EXCLUDED.notes,
      updated_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upserted;

  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) IS
'Backfill/re-sync de tax_withholdings para revenue_entries. Use para correção de dados históricos.';

-- 5) Trigger automático para manter sincronização contínua
CREATE OR REPLACE FUNCTION public.sync_revenue_entries_from_withholdings_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.revenue_entries
    WHERE source_withholding_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.income_category IN ('B', 'F', 'E')
    AND COALESCE(NEW.gross_amount, 0) > 0
    AND NEW.source_sales_invoice_id IS NULL
  THEN
    PERFORM public.sync_revenue_entry_from_withholding(NEW.id);
  ELSE
    DELETE FROM public.revenue_entries
    WHERE source_withholding_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_revenue_entries_from_withholdings
  ON public.tax_withholdings;

CREATE TRIGGER trg_sync_revenue_entries_from_withholdings
AFTER INSERT OR UPDATE OR DELETE ON public.tax_withholdings
FOR EACH ROW
EXECUTE FUNCTION public.sync_revenue_entries_from_withholdings_trigger();

-- 6) Permissões mínimas
REVOKE ALL ON FUNCTION public.map_withholding_income_to_revenue_category(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() TO service_role;