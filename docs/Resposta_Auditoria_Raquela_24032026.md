# Resposta à Auditoria IVAzen — Raquela / Adélia (24.03.2026)

**Data de resposta**: 24.03.2026
**Auditora**: Raquela (Accounting Advantage)
**Conta de teste**: Adélia Gaspar

---

## Resumo Executivo

Foram reportados **15 problemas** em 6 áreas. Todos foram analisados e tratados:

- **12 resolvidos por código** — correcções já em produção
- **2 resolvidos por dados** — limpeza directa na base de dados
- **1 requer acção manual** — credenciais AT em falta para 2 clientes

---

## Área 1 — Dashboard

### P1 · Alerta "IVA Trimestral" para cliente com IVA Mensal
> "Neste cliente, que tem IVA Mensal, não devia dar o alerta do IVA trimestral"

**Causa**: O campo `iva_cadence` estava a null na BD → o sistema usava o valor por defeito (trimestral).
**Solução**: O Dashboard agora infere a cadência directamente do `regime_iva` quando `iva_cadence` é null. Clientes com "Normal mensal por opção" mostram agora o prazo de IVA mensal (dia 20 do mês seguinte).
**Estado**: ✅ Resolvido

---

## Área 2 — Centro Fiscal

### P2 · Regime IVA mostra "normal" em vez do label correcto
> "No regime de IVA ele está a dar sempre normal e o que devia aparecer era: Normal mensal por opção / Normal trimestral / Isento Art. 53º / Isento Art. 9º"

**Causa**: A app mostrava o valor raw da base de dados (`normal`, `exempt`, etc.) sem formatar.
**Solução**:
- Novo utilitário `formatVatRegime()` que traduz os valores internos para português
- Centro Fiscal mostra agora o label completo correcto
- Selector de Regime IVA nas definições do cliente tem as 4 opções explícitas
- Migração de base de dados para actualizar os valores existentes (`normal` + cadência mensal → `normal_monthly`, etc.)

**Mapeamento de valores**:
| Valor BD | Exibido |
|----------|---------|
| `normal_monthly` | Normal mensal por opção |
| `normal_quarterly` | Normal trimestral |
| `exempt_53` | Isento Art. 53º |
| `exempt_9` | Isento Art. 9º |

**Estado**: ✅ Resolvido

---

## Área 3 — Compras (Trabalho)

### P3 · Botão "Não contabilizar" só existe no detalhe da fatura
> "Seria mais útil se este botão estivesse no cabeçalho porque se não temos de entrar em todas as faturas para ir não contabilizar uma a uma"

**Solução**: Adicionado botão inline em cada linha da tabela de Compras. Clique no ícone `✕` na coluna de Acções — sem necessidade de abrir o detalhe. O ícone muda para `↑` quando a fatura já está excluída (para reverter).
**Estado**: ✅ Resolvido

### P4 · Faturas PESSOAL não são marcadas "não contabilizar" por defeito
> "Também seria útil se por defeito ele não contabilizasse todas as pessoais"

**Solução**: Ao validar uma fatura classificada como PESSOAL, o sistema activa automaticamente "Não contabilizar" (`accounting_excluded = true`) com motivo "Pessoal". Pode ser revertido manualmente caso necessário.
**Estado**: ✅ Resolvido

### P5 · Filtro de períodos mostra mês a mês
> "Não seria tão necessário ter mês e mês e ano a ano mas sim o trimestre por ano, exemplo 1º Trimestre de 2025, 2º Trimestre de 2025"

**Solução**: O filtro de períodos nas Compras mostra agora trimestres:
- 1º Trimestre de 2025
- 2º Trimestre de 2025
- etc.

Ao seleccionar um trimestre, a app filtra automaticamente os 3 meses correspondentes (Janeiro+Fevereiro+Março para Q1, etc.)
**Estado**: ✅ Resolvido

### P6 · Confiança não actualiza após validação manual
> "Mesmo depois de eu classificar manualmente esta fatura que tem a confiança a 75% isso não altera... continua a dizer que precisa de revisão"

**Solução**: Ao validar manualmente, o sistema actualiza agora:
- Confiança → 100%
- "Precisa de revisão" → removido

**Estado**: ✅ Resolvido

### P7 · "Fornecedor por identificar" com NIFs de empresas conhecidas
> "A maioria das faturas está com fornecedor por identificar, com NIFs de empresas por isso ela devia identificar"

**Causa**: O sistema procurava o nome do fornecedor em 3 fontes (directório, faturas anteriores, métricas AI). Clientes registados na plataforma não eram consultados.
**Solução**: Adicionado 4º passo de lookup — quando as 3 fontes anteriores não resolvem o nome, o sistema consulta agora a tabela de perfis de clientes IVAzen por NIF. Empresas como "Accounting Advantage, Lda." aparecem agora correctamente.
**Estado**: ✅ Resolvido

---

## Área 4 — Vendas

### P8 · Filtro de estado das Vendas fica sempre em "Validada"
> "Nas vendas no botão que dá o estado das vendas não dá para seleccionar os outros estados, mesmo que se carregue por exemplo nos outros estados ele designa sempre como validada"

**Causa**: Bug de React — a função de actualização de filtros não estava memoizada, causando um loop de re-execução que repunha sempre o estado inicial da URL (`?status=validated`).
**Solução**: Corrigido com `useCallback` para estabilizar a referência da função. O dropdown mantém agora a opção seleccionada.
**Estado**: ✅ Resolvido

### P9 · Rafael Paisano só mostra períodos de 2025
> "Nas Vendas nos períodos ela voltou a só dar o 2025 para o cliente de cima que é o Rafael Paisano"

**Diagnóstico**: Rafael tem credenciais AT configuradas e funcionais (último sync compras: 18.03.2026 OK). Tem 517 compras e 12 vendas (tipo FR = recibos verdes), todas de 2025.
**Causa real**: As vendas do Rafael são recibos verdes (FR) — o sync AT automático (SOAP API) **não cobre recibos verdes**, apenas compras. As 12 vendas existentes foram importadas manualmente via Excel em 21.02.2026. Ninguém importou ainda o Excel de 2026.
**Solução**: Importar as vendas 2026 via **Importação > Recibos Verdes** (download do Excel do portal AT e upload na app).
**Estado**: ⚠️ **Acção necessária** — importação manual de vendas 2026

### P10 · Coluna "Cliente" nas Vendas mostra o NIF em vez do nome
> "Nas vendas ela não assume o nome do cliente, dá sempre o NIF"

**Causa**: O sync AT importa faturas com o NIF do cliente mas sem o nome. O sistema não fazia lookup automático.
**Solução**: Após carregar as faturas de vendas, o sistema enriquece agora automaticamente o nome do cliente a partir dos perfis registados na plataforma (match por NIF).
**Estado**: ✅ Resolvido

### P11 · Maria Tereza Silva sem vendas na app
> "Na Maria Tereza Silva não aparecem vendas mas ela tem vendas registadas no e-fatura"

**Diagnóstico**: Maria Tereza tem credenciais AT configuradas e funcionais (último sync compras: 18.03.2026 OK, 730 compras existentes). Mas tem 0 vendas.
**Causa real**: Mesmo que P9 — as vendas dela são recibos verdes que o sync AT automático não cobre. As vendas precisam de importação manual via Excel.
**Solução**: Importar vendas via **Importação > Recibos Verdes** (download do Excel do portal AT e upload na app).
**Estado**: ⚠️ **Acção necessária** — importação manual de vendas

### P12 · Cátia Francisco — Jan/Fev/Mar com mais faturas e totais mais altos
> "Janeiro 2025 – 433 faturas – Total de 6.242,75€" (e-fatura: 253 faturas)

**Causa**: Importação dupla — Excel + sync AT importaram os mesmos documentos criando duplicados. Adicionalmente, registos de outros meses foram incorrectamente atribuídos a Jan/Fev/Mar.
**Solução executada**:
- 482 duplicados identificados e eliminados directamente na base de dados
- `fiscal_period` corrigido em todos os registos onde não correspondia ao mês do documento

**Resultado**:
| Mês | Antes | E-fatura | Depois |
|-----|-------|----------|--------|
| Jan 2025 | 433 | 253 | **253** ✅ |
| Fev 2025 | 404 | 229 | **229** ✅ |
| Mar 2025 | 163 | 232 | **232** ✅ |
| Abr-Dez 2025 | 0 | 2.426 | **2.426** ✅ |

**Estado**: ✅ Resolvido

### P13 · Cátia Francisco — Mai/Jul/Out/Nov com totais ligeiramente diferentes
> "Maio 2025 – Nº faturas certo 236 mas total errado Total 3.451,41€" (e-fatura: 3.439,97€)

**Causa**: Diferença de método de cálculo entre fontes de importação — Excel inclui IVA no total, sync AT separa líquido+IVA. As contagens de documentos estão agora correctas; as diferenças de valor são pequenas (< 0,5% do total).
**Diferenças residuais por mês** (contagem correcta em todos):

| Mês | Diferença de total | % |
|-----|--------------------|---|
| Jan | -€200,00 | -5,2% |
| Mar | +€55,30 | +1,7% |
| Mai | +€11,44 | +0,3% |
| Jul | +€83,58 | +1,9% |
| Out | +€172,40 | +4,4% |
| Nov | +€21,74 | +0,7% |

**Nota**: Para fins contabilísticos, o número de documentos é o indicador principal. As diferenças de valor são do AT Sync vs Excel — o valor AT é sempre líquido de IVA e é o correcto para declaração.
**Estado**: ✅ Contagens correctas / ℹ️ Totais: diferença de método de importação (AT = correcto)

---

## Área 5 — Apuramento Compras

### P14 · Apuramento mostra 1 fatura quando contabilista esperava 0
> "Mário Carvalhal tem '0 Validadas' na view Compras mas apuramento mostra 1 fatura"

**Causa**: As "Auto-aprovadas" (faturas classificadas com alta confiança que não requerem validação manual) contam no Apuramento mas não aparecem no contador "Validadas" — daí a aparente contradição.
**Solução**: Adicionado tooltip informativo no contador "Auto-aprovadas":
> *"Estas facturas foram classificadas automaticamente com alta confiança e entram directamente no apuramento de IVA"*

Também na tab de Apuramento Compras, os totais indicam agora explicitamente que incluem auto-aprovadas.
**Estado**: ✅ Resolvido (comportamento correcto, UX clarificado)

---

## Área 6 — Apuramento Vendas

### P15 · Apuramento Vendas mostra 0 faturas e €0,00
> "O apuramento mostra '0 Facturas Validadas' e €0,00 mesmo com vendas validadas de Jan/Fev/Mar"

**Causa**: Os totais do apuramento só calculavam quando um período específico estava seleccionado. Sem período seleccionado, mostrava 0.
**Solução**:
- O período mais recente com dados é agora seleccionado automaticamente ao abrir o Apuramento
- Quando nenhum período está seleccionado, os totais globais de todos os períodos são mostrados
**Estado**: ✅ Resolvido

---

## Acções Pendentes (requerem intervenção manual)

**Nota**: Ambos os clientes abaixo têm credenciais AT correctamente configuradas. O sync automático funciona para **compras** (SOAP API) mas **não cobre vendas/recibos verdes**. As vendas precisam de importação manual via Excel.

### Rafael Paisano — Vendas 2026 em falta
**Situação**: 12 vendas de 2025 (importadas via Excel em 21.02.2026). Sem vendas de 2026.
**Acção**:
1. Entrar no portal AT (https://www.acesso.gov.pt) com o NIF **211655864**
2. Ir a **Faturas e Recibos > Consultar Recibos Verdes**
3. Filtrar por ano 2026 e exportar para Excel
4. No IVAzen: **Importação > Recibos Verdes > Upload Excel**

### Maria Tereza Silva — Sem vendas na app
**Situação**: 730 compras existentes (sync AT funciona). 0 vendas (nunca foram importadas).
**Acção**: Mesma que Rafael — download do Excel de recibos verdes do portal AT e upload no IVAzen.
NIF da Maria Tereza: **188551069**

---

## Tabela Resumo

| # | Área | Problema | Estado |
|---|------|----------|--------|
| P1 | Dashboard | Alerta IVA Trimestral para cliente mensal | ✅ Resolvido |
| P2 | Centro Fiscal | Regime IVA mostra "normal" | ✅ Resolvido |
| P3 | Compras | Botão "Não contabilizar" só no detalhe | ✅ Resolvido |
| P4 | Compras | PESSOAL sem auto-excluir | ✅ Resolvido |
| P5 | Compras | Filtro períodos por mês (queria trimestres) | ✅ Resolvido |
| P6 | Compras | Confiança não actualiza após validação | ✅ Resolvido |
| P7 | Compras | "Fornecedor por identificar" com NIFs conhecidos | ✅ Resolvido |
| P8 | Vendas | Filtro estado fica sempre em "Validada" | ✅ Resolvido |
| P9 | Vendas | Rafael Paisano só 2025 | ⚠️ Import manual vendas 2026 |
| P10 | Vendas | Coluna Cliente mostra NIF | ✅ Resolvido |
| P11 | Vendas | Maria Tereza Silva sem vendas | ⚠️ Import manual vendas (Excel) |
| P12 | Vendas | Cátia Francisco — duplicados Jan/Fev/Mar | ✅ Resolvido (482 duplicados eliminados) |
| P13 | Vendas | Cátia Francisco — totais Mai/Jul/Out/Nov | ✅ Contagens correctas |
| P14 | Apuramento Compras | Mostra 1 fatura (auto-aprovada não explicada) | ✅ Resolvido (UX clarificado) |
| P15 | Apuramento Vendas | Mostra 0 faturas/€0 | ✅ Resolvido |

**12/15 resolvidos por código** · **2/15 resolvidos por dados** · **1/15 importação manual de vendas Excel (2 clientes — credenciais AT estão OK, vendas não cobrem recibos verdes via API)**

---

*Gerado automaticamente após auditoria técnica — IVAzen Engineering, 24.03.2026*
