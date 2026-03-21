# Modelo 10 E2E Audit - CAAD, OCR vs AT

Data: 2026-03-07  
Cliente de validacao: `CAAD-Centro de Arbitragem Administrativa`  
NIF: `508840309`

## Resposta curta

Nao, esta parte da app ainda **nao esta 100% fechada**.

O que ja esta provado:
- o universo `AT oficial 2025/2026` do CAAD foi extraido e reconciliado
- o importador AT atual de `Modelo 10` consegue ler o formato novo da AT
- o `zip` manual `CAAD.zip` bate com o universo bruto da AT em contagem e tipos documentais

O que **ainda nao** esta provado:
- que o caminho `OCR/manual PDFs -> upload_queue -> process-queue -> tax_withholdings` produz o mesmo resultado fiscal que a AT
- que o user journey da contabilista esta fechado sem ambiguidades entre `ENI` e `empresa`
- que o fluxo de revisao final do `Modelo 10` esta bom para uso de producao

Conclusao honesta:
- `AT import empresa`: tecnicamente validado ao nivel de totais e preview
- `OCR/manual empresa`: **nao validado** no ambiente vivo
- `Modelo 10 empresa`: **muito perto**, mas ainda falta fechar a prova E2E real

## 1. O que foi comparado

Foram comparadas 3 fontes:

1. `AT oficial` do CAAD em `2025` e `2026`
2. `CAAD.zip` com todos os PDFs manuais
3. estado real do pipeline `OCR/manual` na base de dados

Artefactos principais:
- [CAAD_RECONCILIACAO_AT_2026-03-07.md](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/docs/CAAD_RECONCILIACAO_AT_2026-03-07.md)
- [CAAD_508840309_2025_full.json](/Users/bilal/Programaçao/ivazen-saas/output/at-recibos/CAAD_508840309_2025_full.json)
- [CAAD_508840309_modelo10_beneficiarios_2025.csv](/Users/bilal/Programaçao/ivazen-saas/output/spreadsheet/CAAD_508840309_modelo10_beneficiarios_2025.csv)
- [CAAD_508840309_modelo10_preview_expected.csv](/Users/bilal/Programaçao/ivazen-saas/output/spreadsheet/CAAD_508840309_modelo10_preview_expected.csv)
- [CAAD.zip](/Users/bilal/Downloads/CAAD.zip)

## 2. O que bate certo entre ZIP e AT

### 2.1 Universo bruto

`CAAD.zip`:
- `2698` entradas no zip
- `2697` PDFs

AT oficial `2025`:
- `2697` documentos

Isto bate certo.

### 2.2 Tipos documentais

O `zip` tem exatamente a mesma composicao documental do detalhe AT:

- `FR`: `2688`
- `FRI`: `6`
- `FT`: `1`
- `FTI`: `1`
- `RGI`: `1`

Isto tambem bate certo.

### 2.3 Estado dos documentos

AT `2025`:
- `2608` `Emitido`
- `89` `Anulado`

Como o `zip` inclui anulados, a frase certa e:

- `2697` = universo bruto do zip e da AT
- `2608` = universo ativo apos excluir anulados

Portanto, dizer que "o PDF so pode dar 2608" esta errado se estivermos a falar do ficheiro bruto.  
`2608` so aparece depois do filtro fiscal.

## 3. O que esta provado no caminho AT

O caminho `AT -> Modelo 10` para cliente empresa esta tecnicamente provado nestes niveis:

### 3.1 Totais anuais AT reconciliados

`2025`:
- `2697` docs
- `4.569.023,74 €` base
- `1.035.496,23 €` IVA
- `1.013.911,80 €` IRS

`2026`:
- `466` docs
- `1.000.352,38 €` base
- `227.633,21 €` IVA
- `216.718,94 €` IRS

### 3.2 Regra correta para reconciliar

Para bater com a AT:
- usar `situacao = Emitido`
- para `totalBase`, excluir `RG/RGI`

### 3.3 Preview esperado do importador AT

O importador AT de `Modelo 10` nao usa o universo bruto todo.  
So entram documentos com:
- `Emitido`
- `retenção > 0`

Preview esperado para `2025`:
- `2502` documentos importaveis
- `144` beneficiarios
- `4.396.821,33 €` bruto
- `1.013.911,80 €` retenção

Preview esperado para `2026`:
- `427` documentos importaveis
- `99` beneficiarios
- `943.097,31 €` bruto
- `216.718,94 €` retenção

## 4. O que NAO esta provado no caminho OCR/manual

### 4.1 Estado real do ambiente vivo

No cliente CAAD ativo atual (`client_id = 0ffd28d7-1ff0-4002-82fa-6ce9d7a47816`), ano `2025`:

- `upload_queue total = 2697`
- `pending = 2497`
- `processing = 5`
- `failed = 195`
- `tax_withholdings = 1`

Ou seja:
- o pipeline OCR/manual **nao convergiu**
- os dados nao estao processados de ponta a ponta
- hoje nao ha base para dizer que o OCR bate com a AT

### 4.2 Erro dominante nos failed

As amostras reais de `FAILED` mostram:

- `Unterminated string in JSON at position ...`

Isto sugere falha no parse da resposta do modelo de IA.

### 4.3 Causa tecnica provavel

Em [process-queue/index.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/supabase/functions/process-queue/index.ts), o pipeline continua a fazer:

- limpeza manual simples
- `JSON.parse(jsonStr)` direto

Mas o projeto ja tem um parser robusto em:
- [parseJsonFromAI.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/supabase/functions/_shared/parseJsonFromAI.ts)

Hoje o `process-queue` nao esta a usar esse helper.  
Isto e um gap real e explica bem o padrao dos `195 FAILED`.

## 5. O ponto mais importante que faltava considerar

O caminho AT e o caminho OCR **nao produzem hoje o mesmo shape de dados**.

### 5.1 OCR/manual

O caminho OCR/manual processa **documento a documento**:
- 1 PDF -> 1 item em `upload_queue`
- se passar -> 1 registo em `tax_withholdings` por documento

### 5.2 Importador AT atual

O importador AT atual em [ATRecibosImporter.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/modelo10/ATRecibosImporter.tsx) faz:

- parse documento a documento
- preview agregado por NIF
- import final agregado por beneficiario

Em [convertToModelo10Format](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/atRecibosParser.ts), o import final gera:
- `1 linha por beneficiario`
- `payment_date = 31/12/ano`
- sem `document_reference` individual por documento

Isto significa:
- `AT import` e `OCR/manual` **nao podem ser comparados 1:1 em contagem final de linhas**
- so podem ser comparados hoje por:
  - total anual
  - total por beneficiario
  - total de retenção

### 5.3 Implicacao

Se o objetivo for "os dois caminhos tem de dar o output igual", e preciso primeiro definir o que e "igual":

#### Igual ao nivel de declaracao anual
Sim, isso e possivel e faz sentido:
- totais anuais
- totais por beneficiario
- retenção total

#### Igual ao nivel de auditoria documento a documento
Nao, nao com o design atual.

Para isso, o import AT de empresa teria de:
- guardar staging por documento
- ou criar candidatos por documento
- e so depois agregar para declaracao

## 6. O que isto significa para o fecho do topic

Hoje, esta parte da app esta assim:

### A) Empresa -> AT CSV
Estado: `quase fechado`

Ja temos:
- origem certa
- parser certo
- preview certo
- totais reconciliados

Falta:
- review melhor
- decidir se o import final fica agregado ou documento a documento

### B) Empresa -> OCR/manual PDFs
Estado: `nao fechado`

Ja temos:
- fila
- OCR/AI
- pipeline de processamento

Mas falta a prova principal:
- processar o universo real do CAAD sem ficar preso
- agregar o resultado
- comparar contra a AT

### C) ENI
Estado: `separar melhor no produto`

Para ENI, a journey principal e:
- `vendas/recibos -> SS`
- `compras -> IVA`

O `Modelo 10` nao deve ser apresentado da mesma forma que para empresa pagadora, senao a UX fica errada.

## 7. O que falta para poder dizer "100% operacional"

### 7.1 Critérios de fecho tecnico

1. O CAAD `2025` via OCR/manual tem de terminar sem backlog:
- `pending = 0`
- `processing = 0`
- `failed = 0` ou explicados e residuais

2. O resultado OCR/manual tem de ser agregado por beneficiario e comparado com a AT:
- contagem de beneficiarios
- bruto por beneficiario
- retenção por beneficiario

3. O delta tolerado deve ser:
- `0` na retenção total
- `0` ou residual documentado nos totais por beneficiario

4. O user flow da contabilista tem de suportar review:
- origem AT
- origem OCR
- heuristica
- manual

### 7.2 Critérios de fecho UX

1. O contabilista percebe logo se o cliente e:
- `ENI`
- `empresa`
- `misto`

2. A app mostra a próxima ação certa:
- `Importar AT`
- `Rever candidatos`
- `Validar SS`
- `Exportar Modelo 10`

3. A app nao mistura journeys:
- empresa nao deve parecer ENI
- ENI nao deve entrar num fluxo de Modelo 10 empresa por defeito

## 8. Sugestoes concretas de melhoria ao user journey

### 8.1 Primeiro: tipologia fiscal do cliente

Adicionar um campo explicito no perfil:
- `taxpayer_kind = eni | company | mixed`

Hoje isso esta difuso entre:
- `worker_type`
- `accounting_regime`
- interpretacao do contabilista

E o proprio CAAD ativo esta semanticamente mal modelado:
- `worker_type = independent`
- `accounting_regime = simplified`

Isto esta errado para uma entidade como o CAAD e contamina a UX.

### 8.2 Journey recomendada por tipo de cliente

#### ENI

Fluxo principal:
1. Importar compras
2. Importar vendas/recibos AT
3. Validar IVA
4. Validar SS
5. So mostrar retenções quando existirem e fizer sentido

UI:
- destacar `IVA`
- destacar `Seguranca Social`
- `Modelo 10` como fluxo secundario

#### Empresa pagadora

Fluxo principal:
1. Importar compras/despesas com retenção
2. Importar AT `Bens ou Servicos Adquiridos`
3. Rever retenções
4. Promover para declaracao
5. Exportar Modelo 10

UI:
- destacar `Modelo 10`
- destacar `IVA`
- esconder ou reduzir `SS`

#### Misto

Fluxo principal:
1. Centro fiscal por obrigacao
2. Separar claramente `receitas` de `retenções pagas`

### 8.3 Melhorias de frontend prioritarias

1. `Modelo 10 -> Candidatos`
- review por beneficiario
- drill-down por documento
- origem `AT explicito | OCR | heuristica | manual`

2. `Centro Fiscal do Cliente`
- Compras
- Vendas
- SS
- Modelo 10
- estado por obrigacao

3. `Centro de Importacao`
- `AT`
- `OCR/Documentos`
- `Excel/CSV`
- `SAF-T`

4. `Origem dos dados`
- badge de proveniencia em `tax_withholdings`
- badge de confianca

5. `Preview de reconciliacao`
- total esperado AT
- total em preview
- delta

## 9. Ordem certa de implementacao

1. Corrigir `process-queue` para usar `parseJsonFromAI`
2. Reprocessar `CAAD.zip` num ambiente controlado
3. Gerar agregacao por beneficiario do OCR/manual
4. Comparar com [CAAD_508840309_modelo10_beneficiarios_2025.csv](/Users/bilal/Programaçao/ivazen-saas/output/spreadsheet/CAAD_508840309_modelo10_beneficiarios_2025.csv)
5. Decidir se o import AT fica:
   - agregado por beneficiario
   - ou com staging documento a documento
6. Construir review UI de candidatos/retencoes
7. Corrigir a tipologia fiscal do cliente na UX

## 10. Decisao final

### O que posso afirmar hoje

Sim:
- o universo manual `CAAD.zip` faz sentido e bate com a AT no bruto
- a AT e a melhor fonte de verdade para fechar `Modelo 10 empresa`
- o caminho AT atual esta tecnicamente muito mais perto de producao do que o OCR/manual

Nao:
- nao posso afirmar hoje que a app esta `100% funcional` para `Modelo 10 empresa`
- nao posso afirmar que `OCR/manual` bate com a AT
- nao posso afirmar que a journey da contabilista esta fechada

### Julgamento honesto

Se a pergunta for:

> "Podemos fechar o topic e dizer que Modelo 10 empresa esta 100% resolvido?"

A resposta e:

**Ainda nao.**

Se a pergunta for:

> "Temos agora a base certa e os dados certos para o fechar sem inventar?"

A resposta e:

**Sim.**
