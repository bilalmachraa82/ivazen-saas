-- Supplier Directory: cached NIF → name + CAE lookup
-- Single source of truth for supplier enrichment across the platform.
-- Populated from: AT sync, CSV import, NIF.PT API, VIES, manual override.

CREATE TABLE IF NOT EXISTS supplier_directory (
  nif text PRIMARY KEY,
  name text NOT NULL,
  cae text,
  activity text,
  city text,
  source text NOT NULL DEFAULT 'inferred',
    -- source values: 'at', 'csv', 'nif_pt', 'vies', 'manual', 'inferred'
  confidence smallint NOT NULL DEFAULT 50,
    -- 100 = manual override, 90 = nif_pt/vies, 70 = at/csv, 50 = inferred
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE supplier_directory IS 'Cached supplier NIF → name/CAE directory. Used for enrichment of AT-imported invoices.';
COMMENT ON COLUMN supplier_directory.source IS 'Data provenance: at, csv, nif_pt, vies, manual, inferred';
COMMENT ON COLUMN supplier_directory.confidence IS 'Data quality: 100=manual, 90=api, 70=at/csv, 50=inferred';

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_supplier_directory_source ON supplier_directory (source);

-- Seed from existing data: invoices that DO have names
INSERT INTO supplier_directory (nif, name, cae, source, confidence)
SELECT DISTINCT ON (supplier_nif)
  supplier_nif,
  supplier_name,
  supplier_cae,
  CASE
    WHEN image_path LIKE 'at-sync/%' OR image_path LIKE 'at-webservice/%' THEN 'at'
    WHEN image_path LIKE 'efatura-csv/%' THEN 'csv'
    ELSE 'inferred'
  END,
  70
FROM invoices
WHERE supplier_nif IS NOT NULL
  AND supplier_name IS NOT NULL
  AND supplier_name != ''
  AND supplier_name != 'N/A'
  AND supplier_nif ~ '^\d{9}$'
ORDER BY supplier_nif, created_at DESC
ON CONFLICT (nif) DO NOTHING;

-- Also seed from classification_rules
INSERT INTO supplier_directory (nif, name, source, confidence)
SELECT DISTINCT ON (supplier_nif)
  supplier_nif,
  supplier_name_pattern,
  'inferred',
  50
FROM classification_rules
WHERE supplier_nif IS NOT NULL
  AND supplier_name_pattern IS NOT NULL
  AND supplier_name_pattern != ''
  AND supplier_nif ~ '^\d{9}$'
ORDER BY supplier_nif, usage_count DESC
ON CONFLICT (nif) DO NOTHING;

-- Also seed from classification_examples
INSERT INTO supplier_directory (nif, name, source, confidence)
SELECT DISTINCT ON (supplier_nif)
  supplier_nif,
  supplier_name,
  'inferred',
  50
FROM classification_examples
WHERE supplier_nif IS NOT NULL
  AND supplier_name IS NOT NULL
  AND supplier_name != ''
  AND supplier_nif ~ '^\d{9}$'
ORDER BY supplier_nif
ON CONFLICT (nif) DO NOTHING;
