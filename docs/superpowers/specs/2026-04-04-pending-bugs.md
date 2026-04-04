# IVAzen — Bugs Pendentes (Reportados pela Contabilista)
**Fontes:** PDFs 19.03 e 26.03, Reuniao 30.03 | **Investigado:** 2026-04-04

---

## BUGS CONFIRMADOS NO CODIGO (a corrigir)

### BUG-1: Dashboard IVA cadence defaults para "monthly" em vez de "quarterly"
- **Severidade:** HIGH
- **Ficheiro:** `src/pages/Dashboard.tsx:93`
- **Sintoma:** Clientes trimestrais veem "IVA Mensal - Urgente" no dashboard
- **Root cause:** Fallback `(rawVatRegime ? 'quarterly' : 'monthly')` — quando `vat_regime` e null, assume mensal
- **Fix:** Mudar fallback para `'quarterly'` (maioria dos clientes PT sao trimestrais)
- **Esforco:** 1 linha

### BUG-2: "Nao dedutivel" poe Campo DP = 24 (devia ser null)
- **Severidade:** HIGH
- **Ficheiro:** `supabase/functions/classify-invoice/index.ts:671-677`
- **Sintoma:** Facturas classificadas como PESSOAL/Nao dedutivel aparecem no Campo 24 do apuramento
- **Root cause:** `allowedDpFields` validacao forca qualquer valor fora de {20-24} para 24. Prompt AI nao oferece opcao null.
- **Fix:** Se `classification = 'PESSOAL'`, forcar `dp_field = null` + `deductibility = 0`
- **Esforco:** ~10 linhas no edge function + update prompt AI

### BUG-3: Settings mostra perfil do accountant em vez do cliente seleccionado
- **Severidade:** HIGH
- **Ficheiro:** `src/hooks/useProfile.tsx:82`
- **Sintoma:** Todos os clientes parecem ter os mesmos dados (NIF, IVA, CAE) — na realidade e o perfil do accountant
- **Root cause:** `useProfile()` faz `.eq('id', user.id)` sempre — ignora `selectedClientId`
- **Fix:** Quando accountant tem cliente seleccionado, carregar perfil do cliente
- **Esforco:** ~20 linhas no hook

### BUG-4: Upload PDFs retorna 500 — modelo AI possivelmente deprecado
- **Severidade:** HIGH
- **Ficheiro:** `supabase/functions/extract-invoice-data/index.ts:78`
- **Sintoma:** "Edge Function returned a non-2xx status code" + erros 500 na consola
- **Root cause:** Usa `gemini-3-flash-preview` enquanto todos os outros usam `gemini-3.1-flash-lite-preview`. Modelo pode estar deprecado/inexistente na Google AI API.
- **Nota:** Este modelo e usado intencionalmente para vision/document — verificar se `gemini-3.1-flash-lite-preview` suporta imagens, senao usar `gemini-3.1-flash-preview`
- **Esforco:** 1 linha (nome do modelo) + teste

### BUG-5: Label "Base Incidencia (70%)" hardcoded na SS
- **Severidade:** LOW
- **Ficheiro:** `src/pages/SocialSecurity.tsx:579`
- **Sintoma:** Mostra 70% mesmo quando categorias com coeficientes diferentes estao em uso
- **Fix:** Calcular e mostrar coeficiente ponderado real
- **Esforco:** ~5 linhas

---

## CONFUSOES DE UX (nao bugs, mas precisam de clarificacao)

### UX-1: Sales mostra total COM IVA, SS mostra SEM IVA — discrepancia confusa
- **Ficheiros:** `src/pages/SalesValidation.tsx:156` vs `src/hooks/useSocialSecurity.tsx:478`
- **Comportamento:** Sales soma `total_amount` (com IVA), SS soma base tributavel (sem IVA) via `getSalesInvoiceRevenueAmount()`
- **O calculo SS esta CORRECTO** (tem de ser sem IVA)
- **Fix UX:** Adicionar nota explicativa "Valores sem IVA (base tributavel)" na pagina SS, e/ou mostrar coluna "Base" na tabela de vendas

### UX-2: "So mostra Janeiro" na SS — facturas Fev/Mar provavelmente nao validadas
- **Ficheiro:** `src/hooks/useSocialSecurity.tsx:387`
- **Comportamento:** Query filtra `status = 'validated'`. Se so Janeiro esta validado, so Janeiro aparece.
- **Nao e bug** — e o comportamento esperado (nao calcular SS com facturas nao validadas)
- **Fix UX:** Mostrar aviso "X facturas de Fev/Mar pendentes de validacao" quando existem facturas nao validadas no trimestre

### UX-3: Categorias SS incluem rendas/capitais que nao pertencem a SS
- **Ficheiro:** `src/lib/ssCoefficients.ts:108-109`
- **Fix:** Remover `rendas` (Cat. F) e `capitais` (Cat. E) da lista de categorias SS, ou esconde-las no UI

---

## FEATURES EM FALTA (reportadas como necessarias pela contabilista)

### FEAT-1: Variacao de contribuicao SS (-25% / 0% / +25%)
- **Descricao:** Site SS Directa permite escolher percentagem de variacao sobre rendimento declarado
- **Default:** -25%
- **Nao existe no codigo** — `calculateContributionAmounts()` usa rendimento directo sem variacao
- **Esforco:** ~30 linhas (slider/select + multiplicar base por factor)

### FEAT-2: Determinacao automatica de categoria SS por CAE/CIRS
- **Descricao:** A contabilista quer que o sistema escolha automaticamente a categoria SS (prestacao servicos, vendas, hotelaria, etc.) com base no CAE do cliente
- **Parcialmente existe:** `detectCategoryFromCAE()` em `csvParser.ts` mas NAO e usado na pagina SS
- **Esforco:** ~20 linhas (ligar funcao existente ao UI)

### FEAT-3: Check de isencao SS completo
- **Descricao:** Verificar antes de calcular se o cliente esta isento de SS (primeiros 12 meses Cat. B, pensionistas, invalidez, etc.)
- **Parcialmente existe:** `is_first_year` check, TCO exemption
- **Falta:** Isencao por data inicio actividade (como o caso Agostinho: isento ate 31/11/2024)

### FEAT-4: Categoria SS "Producao energia/arrendamento"
- **Descricao:** Falta esta opcao que existe no site SS Directa
- **Fix:** Adicionar em `ssCoefficients.ts`
- **Esforco:** 5 linhas

### FEAT-5: Buscar dados de actividade/periodicidade IVA da AT
- **Descricao:** O sistema nao tem mecanismo para ir buscar a "Atividade Exercida" ou periodicidade IVA do portal AT. Tudo e manual.
- **Nao existe infra para isto** — seria necessario SOAP extension ou scraping (complexo)

---

## JA CORRIGIDOS (desde os reports de Marco)

| Bug reportado | Estado actual |
|---------------|---------------|
| Dashboard stat cards nao clicaveis | CORRIGIDO — `href` prop no `ZenStatsCard` |
| Validation stat cards nao filtram | CORRIGIDO — `onClick` handlers com `setFilters` |
| Filtros de Compras nao funcionam | CORRIGIDO — todos `onValueChange` ligados |
| Periodos fiscais formato YYYYMM | CORRIGIDO — `formatFiscalPeriod()` + `groupPeriodsToQuarters()` |
| Duplicados requer re-seleccao cliente | NAO REPRODUZIVEL — `DuplicateManager` le de `useSelectedClient` |
| Nomes fornecedores "N/A" | PARCIAL — AT SOAP nao inclui nomes. VIES enrichment corre nightly. Enriquecimento frontend existe mas nao persiste. |

---

## DADOS: Nomes de fornecedores N/A

Nao e um bug — e uma limitacao do AT SOAP API (`fatshareFaturas` nao retorna nomes). Mecanismos existentes:
1. `supplier_directory` lookup (sync-efatura fallback)
2. Historical invoice lookup
3. VIES nightly enrichment cron
4. Frontend `enrichSupplierNames()` (em memoria, nao persiste)

**Opcoes para melhorar:**
- Write-back: quando `enrichSupplierNames()` encontra nome, gravar no `invoices.supplier_name`
- One-time backfill: script que resolve nomes para todos os NIFs via VIES/NIF.pt
- Aumentar cobertura VIES: muitos pequenos fornecedores PT nao estao no VIES

---

## PLANO PRIORITIZADO

### Urgente (corrigir hoje/amanha)
1. **BUG-1** Dashboard IVA cadence fallback → 1 linha
2. **BUG-2** "Nao dedutivel" Campo DP → ~10 linhas
3. **BUG-4** Modelo AI extract-invoice-data → 1 linha + deploy
4. **BUG-3** Settings mostra perfil errado → ~20 linhas

### Esta semana
5. **FEAT-1** Variacao SS -25% → ~30 linhas
6. **FEAT-2** Auto-categoria SS por CAE → ~20 linhas
7. **UX-1** Nota "valores sem IVA" na SS → ~5 linhas
8. **UX-3** Remover rendas/capitais das categorias SS → ~5 linhas

### Proximo sprint
9. **FEAT-3** Check isencao SS completo
10. **FEAT-4** Categoria "Producao energia/arrendamento"
11. **UX-2** Aviso facturas nao validadas no trimestre
12. Supplier name write-back
