
-- ============================================
-- 1) ASSOCIAR ADÉLIA AOS CLIENTES DO BILAL
-- ============================================
INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
SELECT 
  ca.client_id,
  '4cbe8e41-8127-49e2-a3f7-81bbfca89926' AS accountant_id,
  'full' AS access_level,
  FALSE AS is_primary,
  '980f4331-f39d-46b7-b6f1-274f95dab9ad' AS invited_by
FROM client_accountants ca
WHERE ca.accountant_id = '980f4331-f39d-46b7-b6f1-274f95dab9ad'
  AND NOT EXISTS (
    SELECT 1 FROM client_accountants ca2
    WHERE ca2.client_id = ca.client_id
    AND ca2.accountant_id = '4cbe8e41-8127-49e2-a3f7-81bbfca89926'
  );

-- ============================================
-- 2) ATUALIZAR RLS DE INVOICES
-- ============================================
DROP POLICY IF EXISTS "Accountants can view client invoices" ON invoices;
DROP POLICY IF EXISTS "Accountants can update client invoices" ON invoices;
DROP POLICY IF EXISTS "Accountants can insert client invoices" ON invoices;

CREATE POLICY "Accountants can view client invoices via association"
ON invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = invoices.client_id
    AND ca.accountant_id = auth.uid()
  )
);

CREATE POLICY "Accountants can update client invoices via association"
ON invoices FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = invoices.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can insert client invoices via association"
ON invoices FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = invoices.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- ============================================
-- 3) ATUALIZAR RLS DE SALES_INVOICES
-- ============================================
DROP POLICY IF EXISTS "Accountants can view client sales invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Accountants can update client sales invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Accountants can insert client sales invoices" ON sales_invoices;

CREATE POLICY "Accountants can view client sales invoices via association"
ON sales_invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = sales_invoices.client_id
    AND ca.accountant_id = auth.uid()
  )
);

CREATE POLICY "Accountants can update client sales invoices via association"
ON sales_invoices FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = sales_invoices.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can insert client sales invoices via association"
ON sales_invoices FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = sales_invoices.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- ============================================
-- 4) ATUALIZAR RLS DE TAX_WITHHOLDINGS
-- ============================================
DROP POLICY IF EXISTS "Accountants can view client withholdings" ON tax_withholdings;
DROP POLICY IF EXISTS "Accountants can update client withholdings" ON tax_withholdings;
DROP POLICY IF EXISTS "Accountants can insert client withholdings" ON tax_withholdings;
DROP POLICY IF EXISTS "Accountants can delete client withholdings" ON tax_withholdings;

CREATE POLICY "Accountants can view client withholdings via association"
ON tax_withholdings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = tax_withholdings.client_id
    AND ca.accountant_id = auth.uid()
  )
);

CREATE POLICY "Accountants can update client withholdings via association"
ON tax_withholdings FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = tax_withholdings.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can insert client withholdings via association"
ON tax_withholdings FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = tax_withholdings.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can delete client withholdings via association"
ON tax_withholdings FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = tax_withholdings.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- ============================================
-- 5) ATUALIZAR RLS DE SS_DECLARATIONS
-- ============================================
DROP POLICY IF EXISTS "Accountants can view client declarations" ON ss_declarations;

CREATE POLICY "Accountants can view client declarations via association"
ON ss_declarations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = ss_declarations.client_id
    AND ca.accountant_id = auth.uid()
  )
);

CREATE POLICY "Accountants can insert client declarations via association"
ON ss_declarations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = ss_declarations.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can update client declarations via association"
ON ss_declarations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = ss_declarations.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- ============================================
-- 6) ATUALIZAR RLS DE REVENUE_ENTRIES
-- ============================================
DROP POLICY IF EXISTS "Accountants can view client revenue entries" ON revenue_entries;

CREATE POLICY "Accountants can view client revenue entries via association"
ON revenue_entries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = revenue_entries.client_id
    AND ca.accountant_id = auth.uid()
  )
);

CREATE POLICY "Accountants can insert client revenue entries via association"
ON revenue_entries FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = revenue_entries.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can update client revenue entries via association"
ON revenue_entries FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = revenue_entries.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can delete client revenue entries via association"
ON revenue_entries FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = revenue_entries.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- ============================================
-- 7) ATUALIZAR FUNÇÃO search_available_clients
-- ============================================
DROP FUNCTION IF EXISTS search_available_clients(text);

CREATE FUNCTION search_available_clients(search_term text)
RETURNS TABLE(
  id uuid,
  full_name text,
  nif text,
  email text,
  company_name text,
  already_associated boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.nif,
    p.email,
    p.company_name,
    EXISTS (
      SELECT 1 FROM client_accountants ca 
      WHERE ca.client_id = p.id AND ca.accountant_id = auth.uid()
    ) AS already_associated
  FROM profiles p
  WHERE 
    p.id != auth.uid()
    AND (
      p.full_name ILIKE '%' || search_term || '%'
      OR p.nif ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
      OR p.company_name ILIKE '%' || search_term || '%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM client_accountants ca 
      WHERE ca.client_id = p.id AND ca.accountant_id = auth.uid()
    )
  ORDER BY p.full_name
  LIMIT 20;
END;
$$;
