# Auditoria Final Independente
## IVAzen SaaS | 31 de Marco de 2026

Este documento consolida o estado final validado de forma independente no repositório, na base de dados de producao e no browser.

## Estado final

| Item | Estado |
|------|--------|
| `HEAD` local | `3b850c7` |
| `origin/main` | `3b850c7` |
| Alinhamento local/remoto | OK |
| Lint | OK |
| Build | OK |
| Testes | `868/868` pass (`41` ficheiros) |
| Alias Vercel | `https://ivazen-saas.vercel.app` validado |
| Dominio custom | `https://ivazen.aiparati.pt` nao resolve deste ambiente |

## Commits finais relevantes

| Commit | Descricao |
|--------|-----------|
| `3b850c7` | fix(search): accent-insensitive client search across all selectors |
| `44e4613` | fix(import): block AT sales csv in purchases parser |
| `b16dfd1` | chore: gitignore vercel backup dirs and tsbuildinfo |
| `68c98d7` | fix(sync): redirect self-purchases to sales_invoices instead of discarding |
| `f1d7efe` | fix(validation): exclude accounting_excluded invoices from status filters |
| `1320661` | fix(ronda3): resolve 12 audit findings from accountant session 30.03.2026 |

## Correccoes de dados confirmadas

Migracoes de compras mal classificadas para `sales_invoices`:

| Origem | Registos |
|--------|----------|
| `migration_999_fix` | `26` |
| `migration_self_nif_fix` | `51` |
| `migration_csv_sales_fix` | `2` |
| **Total** | **79** |

### Maria Teresa

| Verificacao | Resultado |
|-------------|-----------|
| Compras com `supplier_nif='999999990'` | `0` |
| Compras `FR M/...` restantes em `invoices` | `0` |
| Vendas corrigidas dela | `28` |
| Breakdown | `26 migration_999_fix` + `2 migration_csv_sales_fix` |

### Rafael Paisano

| Campo | Valor final |
|-------|-------------|
| `vat_regime` | `normal_monthly` |
| `iva_cadence` | `monthly` |

## Acesso da Adelia / Raquela

| Verificacao | Resultado |
|-------------|-----------|
| ID Adelia | `139245bb-9749-49c6-8679-18ea7c5b1401` |
| `get_accountant_clients(adelia_id)` | `432` clientes |
| `client_accountants` da Adelia | `432` clientes |
| Clientes antes presos a outro contabilista | corrigidos |
| Pesquisa `mário` no selector | encontra `Mário Manuel da Silva Carvalhal` |

Nota: havia `26` clientes ainda herdados da Cláudia Azevedo. Foram reassociados e a carteira da Adelia passou de `406` para `432`.

## Integridade contabilistica confirmada

| Verificacao | Resultado |
|-------------|-----------|
| Compras com `supplier_nif='999999990'` | `0` |
| Compras com `supplier_nif=client_nif` nos casos auditados | `0` |
| Compras `FR M/...` da Maria Teresa | `0` |
| Compras com `doc_type='FV'` | `0` |
| Guarda SOAP para self-purchases | activa |
| Guarda CSV para vendas AT cair em compras | activa |

## Validacoes funcionais confirmadas

No alias Vercel, com a conta `adelia.gaspar@accountingadvantage.pt`:

- login funciona
- dashboard abre
- selector mostra `432` clientes
- `mário` encontra o cliente esperado
- Agostinho aparece e continua acessivel

Validacoes previamente confirmadas nesta ronda:

- stats cards de Compras nao ficam presos a zero
- filtro `Pendentes` exclui `accounting_excluded`
- reconciliacao nao mostra triplicados falsos
- revenue de SS usa base tributavel sem IVA
- Agostinho tem `278` vendas em janeiro 2026

## Riscos residuais nao bloqueadores

| Item | Estado |
|------|--------|
| Dominio custom `ivazen.aiparati.pt` | nao resolvido deste ambiente; alias Vercel funcional |
| Upload PDF IA nesta ultima passada | nao re-testado nesta sessao final; anteriormente validado com `AI_API_KEY` presente e edge function funcional |
| Perfis VAT de outros clientes | podem precisar de revisao manual caso a caso |

## Veredito

**Pode ser entregue**, com a ressalva operacional de que o alias Vercel foi o endpoint efectivamente validado neste ambiente. O estado versionado, os testes, as correccoes de BD e o acesso da Adelia/Raquela estao coerentes com o estado final auditado.
