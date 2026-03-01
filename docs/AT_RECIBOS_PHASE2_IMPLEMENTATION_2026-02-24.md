# AT Recibos Fase 2 — Implementação Técnica (2026-02-24)

## Objetivo
Ligar o fluxo de recibos/rendas (`tax_withholdings`) ao cálculo de Segurança Social (`revenue_entries`) sem tocar no pipeline AT de compras/vendas (`invoices`/`sales_invoices`).

## O que foi implementado
### 1) Migração nova
Ficheiro: `supabase/migrations/20260224103000_sync_revenue_entries_from_withholdings.sql`

Inclui:
- coluna `revenue_entries.source_withholding_id` com `FK -> tax_withholdings(id)`
- `UNIQUE (source_withholding_id)` para idempotência
- função de mapeamento: `map_withholding_income_to_revenue_category(text)`
- sync unitário: `sync_revenue_entry_from_withholding(uuid)`
- backfill em lote: `sync_revenue_entries_from_withholdings(uuid, integer)`
- trigger automático `AFTER INSERT/UPDATE/DELETE` em `tax_withholdings`
  - INSERT/UPDATE: cria/atualiza `revenue_entries`
  - DELETE: remove `revenue_entries` associado
- guardrail anti-dupla-contagem: ignora retenções com `source_sales_invoice_id` preenchido

### 2) UI (clareza funcional)
- `src/components/modelo10/ATRecibosImporter.tsx`
  - corrigido import de ícone `Info`
  - mensagem atualizada: recibos alimentam retenções + SS; não criam vendas IVA
- `src/components/modelo10/EmailNotificationImporter.tsx`
  - mensagem equivalente de escopo funcional

## Escopo e limites
- Este trabalho **não altera** `sync-efatura`, `process-at-sync-queue`, `sync-queue-manager`.
- Este trabalho **não cria automaticamente vendas IVA** a partir de recibos AT.
- O IVA continua a depender de `sales_invoices` (faturas/vendas), fluxo separado.
- Se já existir uma retenção ligada a venda (`source_sales_invoice_id`), não é gerada receita SS duplicada.

## SQL de validação (após aplicar migração)
```sql
-- A) Confirmar coluna e função
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'revenue_entries'
  and column_name = 'source_withholding_id';

select proname
from pg_proc
where proname in (
  'map_withholding_income_to_revenue_category',
  'sync_revenue_entry_from_withholding',
  'sync_revenue_entries_from_withholdings'
)
order by proname;
```

```sql
-- B) Confirmar trigger ativo
select tgname
from pg_trigger
where tgrelid = 'public.tax_withholdings'::regclass
  and not tgisinternal;
```

```sql
-- C) Backfill manual (opcional) para 1 cliente/ano
-- substituir UUID do cliente e ano
select public.sync_revenue_entries_from_withholdings(
  '00000000-0000-0000-0000-000000000000'::uuid,
  2025
);
```

```sql
-- D) Conferir linhas sincronizadas
select
  re.client_id,
  re.period_quarter,
  re.category,
  re.amount,
  re.source,
  re.source_withholding_id
from public.revenue_entries re
where re.source = 'at_withholding_sync'
order by re.created_at desc
limit 50;
```
