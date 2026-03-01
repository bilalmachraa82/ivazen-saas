# AT Control Center Baseline (Freeze Técnico)

**Data:** 2026-02-25  
**Objetivo:** congelar KPIs de referência antes do rollout do painel único e staging de retenções.

## KPIs alvo (24h / 7d)

1. `at_sync_jobs`: total, completed, error, pending, processing.
2. `at_sync_history.reason_code`: distribuição.
3. Compras e vendas importadas por 24h.
4. Retenções (`tax_withholdings`) por 24h.
5. Lotes com filas presas (>15 minutos sem progresso).
6. Clientes com `AT_AUTH_FAILED`.

## SQL baseline (copiar/colar)

```sql
select status, count(*)
from public.at_sync_jobs
where created_at > now() - interval '24 hours'
group by 1
order by 2 desc;
```

```sql
select reason_code, count(*)
from public.at_sync_history
where created_at > now() - interval '24 hours'
group by 1
order by 2 desc;
```

```sql
select
  count(*) filter (where created_at > now() - interval '24 hours') as compras_24h
from public.invoices
where efatura_source in ('webservice', 'portal_json');
```

```sql
select
  count(*) filter (where created_at > now() - interval '24 hours') as vendas_24h
from public.sales_invoices;
```

```sql
select
  count(*) filter (where created_at > now() - interval '24 hours') as withholdings_24h
from public.tax_withholdings;
```

```sql
select
  p.nif,
  p.full_name,
  count(*) as errors_7d,
  max(h.created_at) as last_error_at
from public.at_sync_history h
join public.profiles p on p.id = h.client_id
where h.created_at > now() - interval '7 days'
  and h.reason_code = 'AT_AUTH_FAILED'
group by p.nif, p.full_name
order by last_error_at desc;
```

## Resultado baseline (preencher)

- Jobs 24h:
- Reason codes 24h:
- Compras 24h:
- Vendas 24h:
- Retenções 24h:
- Clientes AT_AUTH_FAILED:

## Critério de não-regressão

1. `AT_STARTDATE_FUTURE` deve manter-se em zero.
2. Nenhum aumento de filas presas.
3. Compras e vendas não podem cair por regressão técnica.
4. Retenções candidatas não podem contaminar `tax_withholdings` sem revisão/auto-promoção válida.

