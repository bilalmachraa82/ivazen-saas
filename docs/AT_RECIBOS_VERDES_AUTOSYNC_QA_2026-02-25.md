# AT Recibos Verdes Auto-Sync — QA Report

**Timestamp UTC:** 2026-02-25T14:05:00Z  
**Commit validado:** 72ccf58 (origin/main)  
**Funções deployadas:** `fetch-efatura-portal`, `process-at-sync-queue`  
**Secret configurado:** `AT_AUTO_WITHHOLDINGS_SYNC=1`

---

## 1. Deploy

| Item | Status |
|------|--------|
| `fetch-efatura-portal` deploy | ✅ OK |
| `process-at-sync-queue` deploy | ✅ OK |
| `AT_AUTO_WITHHOLDINGS_SYNC` secret | ✅ Configurado |

## 2. Smoke Test (NIF 232945993)

- Job criado: `b3ab4433-7728-4325-bc47-29af26d609bc`
- Batch: `8eb1aebc-2716-4f75-91f8-b65dc1e3b49d`
- Resultado: **error** — `Fora do período válido de invocação (19h-07h)`
- **Interpretação:** O processador `process-at-sync-queue` executou corretamente, o job foi despachado e processado. O erro é uma restrição do conector AT (portal só opera 19h-07h). O deploy está funcional.

## 3. SQL Outputs

### A) Evidência de sync (últimas 24h)

```
withholdings: nil (em todas as runs)
```

**Nota:** As runs às 06:05 usaram o código anterior ao deploy. O auto-sync de retenções só será visível na próxima run noturna (19:30 ou 06:00) com o novo código deployado.

### B) Novas retenções auto-importadas

```
auto_withholdings_24h: 0
```

**Esperado:** O deploy ocorreu às ~14:03. O próximo ciclo noturno (19:30 ou 06:00) será o primeiro com a feature ativa.

### C) Sem regressão compras/vendas

```
compras_24h: 105
vendas_24h: 29
```

✅ Pipeline AT de compras/vendas continua operacional.

### D) Duplicados de retenções

```
(0 linhas)
```

✅ Sem duplicações.

## 4. Tabela PASS/FAIL

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | Deploy das 2 funções OK | **PASS** |
| 2 | Secret `AT_AUTO_WITHHOLDINGS_SYNC` configurado | **PASS** |
| 3 | `metadata.withholdings` em runs recentes | **PENDING** — próximo ciclo noturno |
| 4 | `tax_withholdings` com `notes 'AT auto portal_json%'` | **PENDING** — próximo ciclo noturno |
| 5 | Compras/vendas sem regressão (105/29 em 24h) | **PASS** |
| 6 | Query de duplicados = 0 linhas | **PASS** |
| 7 | Sem 401/403 inesperado no fluxo interno | **PASS** |

## 5. Blockers

| Blocker | Detalhe |
|---------|---------|
| Janela horária AT | Portal AT opera apenas 19h-07h. O smoke test diurno falha por design. Primeiro ciclo completo: **hoje às 19:30** |
| Clientes com `AT_AUTH_FAILED` | 8 clientes com credenciais inválidas (reportados no QA anterior). Ação: atualizar passwords em Definições → Credenciais AT |

## 6. Conclusão

O deploy está **completo e funcional**. Todos os critérios controláveis estão PASS. Os 2 critérios PENDING (evidência de `metadata.withholdings` e novas linhas em `tax_withholdings`) dependem do primeiro ciclo noturno do scheduler (19:30 de hoje), que será o primeiro a executar com o novo código + secret ativo.

**Recomendação:** Verificar amanhã de manhã (após ciclo 06:00) com:

```sql
select created_at, status, metadata->'withholdings' as withholdings
from public.at_sync_history
where created_at > '2026-02-25 19:00:00+00'
  and metadata->'withholdings' is not null
order by created_at desc
limit 20;

select count(*) from public.tax_withholdings
where created_at > '2026-02-25 19:00:00+00'
  and notes like 'AT auto portal_json%';
```
