-- B6: Verificar Contagens (executar APÓS importar tudo)
SELECT 'auth.users' AS tabela, count(*) AS rows FROM auth.users
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
UNION ALL SELECT 'invoices', count(*) FROM public.invoices
UNION ALL SELECT 'invoice_vat_lines', count(*) FROM public.invoice_vat_lines
UNION ALL SELECT 'tax_withholdings', count(*) FROM public.tax_withholdings
UNION ALL SELECT 'sales_invoices', count(*) FROM public.sales_invoices
UNION ALL SELECT 'revenue_entries', count(*) FROM public.revenue_entries
UNION ALL SELECT 'at_credentials', count(*) FROM public.at_credentials
UNION ALL SELECT 'client_accountants', count(*) FROM public.client_accountants
UNION ALL SELECT 'classification_rules', count(*) FROM public.classification_rules
UNION ALL SELECT 'at_sync_history', count(*) FROM public.at_sync_history
UNION ALL SELECT 'at_sync_jobs', count(*) FROM public.at_sync_jobs
UNION ALL SELECT 'upload_queue', count(*) FROM public.upload_queue
UNION ALL SELECT 'at_withholding_candidates', count(*) FROM public.at_withholding_candidates
ORDER BY tabela;