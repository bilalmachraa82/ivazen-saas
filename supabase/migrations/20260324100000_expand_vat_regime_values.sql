-- Expand vat_regime column to support specific Portuguese VAT regime labels.
-- Previously only 'normal', 'simplified', 'exempt' were used.
-- Now supports 'normal_monthly', 'normal_quarterly', 'exempt_53', 'exempt_9'
-- for precise display in Centro Fiscal.

-- Migrate existing 'normal' values:
-- For monthly cadence → normal_monthly; for quarterly (default) → normal_quarterly
UPDATE public.profiles
SET vat_regime = CASE
  WHEN iva_cadence = 'monthly' THEN 'normal_monthly'
  ELSE 'normal_quarterly'
END
WHERE vat_regime = 'normal';

-- Migrate legacy 'exempt' → 'exempt_53' (Art. 53º is the most common exemption for small businesses)
UPDATE public.profiles
SET vat_regime = 'exempt_53'
WHERE vat_regime = 'exempt';

-- No constraint change needed — vat_regime is unconstrained text column.
-- Valid values (by convention): 'normal_monthly', 'normal_quarterly', 'exempt_53', 'exempt_9', 'simplified'
