-- Consolidation migration:
-- 1) Final grants for SECURITY DEFINER recibos sync functions
-- 2) Admin-auditable fiscal year override registry
-- 3) Operational health view for AT sync status per client

-- -----------------------------------------------------
-- 1) Final grants (idempotent)
-- -----------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) FROM anon;

GRANT EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) TO authenticated;

-- -----------------------------------------------------
-- 2) Admin-auditable override for historical years
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.at_sync_year_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  reason text NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_sync_year_overrides_fiscal_year_check CHECK (fiscal_year >= 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_at_sync_year_overrides_active
  ON public.at_sync_year_overrides(accountant_id, fiscal_year)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_at_sync_year_overrides_lookup
  ON public.at_sync_year_overrides(accountant_id, fiscal_year, is_active, expires_at);

ALTER TABLE public.at_sync_year_overrides ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.at_sync_override_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id uuid REFERENCES public.at_sync_year_overrides(id) ON DELETE SET NULL,
  accountant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES public.profiles(id),
  fiscal_year integer NOT NULL,
  batch_id uuid,
  source text NOT NULL DEFAULT 'sync-queue-manager',
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_at_sync_override_audit_accountant_year
  ON public.at_sync_override_audit(accountant_id, fiscal_year, used_at DESC);

ALTER TABLE public.at_sync_override_audit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_at_sync_year_override_active(
  p_accountant_id uuid,
  p_fiscal_year integer
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.at_sync_year_overrides o
    WHERE o.accountant_id = p_accountant_id
      AND o.fiscal_year = p_fiscal_year
      AND o.is_active = true
      AND (o.expires_at IS NULL OR o.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.is_at_sync_year_override_active(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_at_sync_year_override_active(uuid, integer) TO service_role;

-- -----------------------------------------------------
-- 3) Operational health view
-- -----------------------------------------------------
CREATE OR REPLACE VIEW public.at_sync_health_view AS
WITH ranked AS (
  SELECT
    h.*,
    row_number() OVER (PARTITION BY h.client_id ORDER BY h.created_at DESC) AS rn
  FROM public.at_sync_history h
)
SELECT
  r.client_id,
  r.created_at AS last_sync_at,
  r.sync_method,
  r.status,
  r.reason_code,
  r.error_message,
  r.records_imported,
  r.records_skipped,
  r.records_errors,
  r.metadata->>'method' AS method,
  COALESCE((r.metadata#>>'{directions,compras,totalRecords}')::integer, 0) AS compras_total,
  COALESCE((r.metadata#>>'{directions,vendas,totalRecords}')::integer, 0) AS vendas_total
FROM ranked r
WHERE r.rn = 1;

GRANT SELECT ON public.at_sync_health_view TO authenticated;
GRANT SELECT ON public.at_sync_health_view TO service_role;
