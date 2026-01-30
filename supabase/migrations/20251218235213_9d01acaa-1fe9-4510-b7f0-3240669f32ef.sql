-- Add unique constraint on supplier_nif for upsert functionality
ALTER TABLE ai_metrics ADD CONSTRAINT ai_metrics_supplier_nif_unique UNIQUE (supplier_nif);

-- Create RPC function to update AI metrics
CREATE OR REPLACE FUNCTION public.update_ai_metrics(
  p_supplier_nif TEXT,
  p_supplier_name TEXT DEFAULT NULL,
  p_was_correction BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ai_metrics (
    supplier_nif, 
    supplier_name, 
    total_classifications, 
    total_corrections, 
    last_classification_at, 
    last_correction_at
  )
  VALUES (
    p_supplier_nif, 
    p_supplier_name, 
    1, 
    CASE WHEN p_was_correction THEN 1 ELSE 0 END,
    NOW(),
    CASE WHEN p_was_correction THEN NOW() ELSE NULL END
  )
  ON CONFLICT (supplier_nif) DO UPDATE SET
    total_classifications = ai_metrics.total_classifications + 1,
    total_corrections = ai_metrics.total_corrections + CASE WHEN p_was_correction THEN 1 ELSE 0 END,
    last_classification_at = NOW(),
    last_correction_at = CASE WHEN p_was_correction THEN NOW() ELSE ai_metrics.last_correction_at END,
    supplier_name = COALESCE(EXCLUDED.supplier_name, ai_metrics.supplier_name),
    updated_at = NOW();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_ai_metrics(TEXT, TEXT, BOOLEAN) TO authenticated;