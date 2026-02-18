# Runbook: Reconciliacao Trimestral (IVAzen)

## Objetivo
Fechar reconciliacao trimestral com evidência documental, sem ajustes manuais por SQL para "forcar" totais.

## Pre-Checks
1. Confirmar commit em producao (hash).
2. Confirmar deploy da `extract-invoice-data` quando houver alteracoes OCR.
3. Confirmar cliente e periodo (ex.: Q3 2025).

## Fluxo Operacional
1. Validacao de compras:
   - Reextrair documentos problematicos via botao `Re-extrair OCR`.
   - Confirmar reset de revisao: `status=classified`, `requires_accountant_validation=true`.
2. Validacao contabilistica:
   - Ajustar apenas `final_dp_field`, `final_deductibility`, `exclusion_reason` quando aplicavel.
3. Validacao de vendas:
   - Garantir documentos em estado `validated` ou `classified`.
4. Exportacao:
   - Gerar Excel DP e confirmar 4 sheets:
     - Resumo DP
     - Detalhe
     - Lista Facturas
     - Lista Vendas

## SQL Checklist (obrigatorio)
### Compras por campo
```sql
SELECT
  COALESCE(final_dp_field, ai_dp_field, 24) AS dp_field,
  COUNT(*) AS n_docs,
  ROUND(SUM(COALESCE(total_vat,0)),2) AS vat_total,
  ROUND(SUM(COALESCE(total_vat,0) * COALESCE(final_deductibility, ai_deductibility, 0) / 100.0),2) AS vat_deductivel
FROM invoices
WHERE client_id = :client_id
  AND fiscal_period IN (:periodos)
  AND status IN ('classified','validated')
  AND COALESCE(exclusion_reason,'') = ''
GROUP BY 1
ORDER BY 1;
```

### Vendas totais
```sql
SELECT
  COUNT(*) AS n_vendas,
  ROUND(SUM(COALESCE(total_amount,0)),2) AS total_vendas,
  ROUND(SUM(COALESCE(vat_standard,0)+COALESCE(vat_intermediate,0)+COALESCE(vat_reduced,0)),2) AS iva_liquidado
FROM sales_invoices
WHERE client_id = :client_id
  AND fiscal_period IN (:periodos)
  AND status IN ('classified','validated');
```

### Auditoria de reextracao
```sql
SELECT invoice_id, action, created_at, changes
FROM invoice_validation_logs
WHERE invoice_id IN (:invoice_ids)
ORDER BY created_at DESC
LIMIT 20;
```

## Criterios de Fecho
1. Totais de compras e vendas reconciliados com benchmark (ou diferenca explicada por regra contabilistica).
2. Sem SQL manual para alterar `total_vat`.
3. Logs de auditoria existentes para documentos reextraidos.
4. Relatorio final PASS/FAIL por criterio.

