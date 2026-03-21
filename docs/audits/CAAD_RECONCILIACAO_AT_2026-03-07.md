# CAAD Reconciliacao AT 2025-2026

Data: 2026-03-07  
Cliente: `CAAD-Centro de Arbitragem Administrativa`  
NIF: `508840309`

## Resultado curto

Sim, o IVAzen ja tem prova tecnica de que consegue usar a AT como origem estruturada para `Modelo 10` do CAAD, sem depender de importacao manual de `2697` PDFs.

O que foi validado:
- export oficial AT de `2025` e `2026` concluido
- parser do IVAzen adaptado ao formato atual da AT
- reconciliacao dos totais AT explicada e fechada

O ponto mais importante:
- o erro inicial na soma vinha de contar documentos `Anulado`
- os agregados oficiais da AT batem com os documentos `Emitido`
- para `totalBase`, a AT exclui `RG/RGI`

## Ficheiros de prova

Export completo AT:
- `/Users/bilal/Programaçao/ivazen-saas/output/at-recibos/CAAD_508840309_2025_full.json`
- `/Users/bilal/Programaçao/ivazen-saas/output/at-recibos/CAAD_508840309_2025_full_api.csv`
- `/Users/bilal/Programaçao/ivazen-saas/output/at-recibos/CAAD_508840309_2025_retencoes_api.csv`
- `/Users/bilal/Programaçao/ivazen-saas/output/at-recibos/CAAD_508840309_2026_full.json`
- `/Users/bilal/Programaçao/ivazen-saas/output/at-recibos/CAAD_508840309_2026_full_api.csv`
- `/Users/bilal/Programaçao/ivazen-saas/output/at-recibos/CAAD_508840309_2026_retencoes_api.csv`

Reconciliacao:
- `/Users/bilal/Programaçao/ivazen-saas/output/spreadsheet/CAAD_508840309_at_reconciliation_2025_2026.csv`
- `/Users/bilal/Programaçao/ivazen-saas/output/spreadsheet/CAAD_508840309_at_reconciliation_by_status_type.csv`

Resumo por beneficiario:
- `/Users/bilal/Programaçao/ivazen-saas/output/spreadsheet/CAAD_508840309_modelo10_beneficiarios_2025.csv`
- `/Users/bilal/Programaçao/ivazen-saas/output/spreadsheet/CAAD_508840309_modelo10_beneficiarios_2026.csv`

## Numeros finais de confianca

### 2025

Agregado oficial AT:
- `totalDocs = 2697`
- `totalBase = 4.569.023,74`
- `totalIva = 1.035.496,23`
- `totalIrs = 1.013.911,80`

Reconciliacao correta no detalhe:
- `2697` linhas totais na API
- `2608` documentos `Emitido`
- `2607` documentos `Emitido` sem `RG/RGI`
- `Emitido sem RG/RGI -> valorBase = 4.569.023,74`
- `Emitido -> valorIva = 1.035.496,23`
- `Emitido -> valorIRS = 1.013.911,80`
- `144` beneficiarios com retenção

### 2026

Agregado oficial AT:
- `totalDocs = 466`
- `totalBase = 1.000.352,38`
- `totalIva = 227.633,21`
- `totalIrs = 216.718,94`

Reconciliacao correta no detalhe:
- `466` linhas totais na API
- `442` documentos `Emitido`
- `441` documentos `Emitido` sem `RG`
- `Emitido sem RG -> valorBase = 1.000.352,38`
- `Emitido -> valorIva = 227.633,21`
- `Emitido -> valorIRS = 216.718,94`
- `99` beneficiarios com retenção

## Porque parecia estar errado

Na primeira analise, a soma de `valorIRS` estava inflacionada porque juntava:
- `Emitido`
- `Anulado`

Exemplo:
- `2025`: somar tudo dava `1.740.184,05`, o que parecia nao bater com a AT
- mas somando so `Emitido`, o valor passa para `1.013.911,80`, que bate com a AT

Conclusao:
- para reconciliacao fiscal, o filtro certo e `situacao = Emitido`
- para `totalBase`, tambem e preciso excluir `RG/RGI`

## O que ja funciona no produto

No codigo local, o IVAzen ja consegue:
- ler o CSV atual da AT de `Bens ou Servicos Adquiridos`
- normalizar headers com encoding errado
- aceitar decimais com `3` casas
- distinguir o fluxo de empresa (`Modelo 10`) do fluxo ENI (`vendas/SS`)

Ficheiros principais:
- [atRecibosParser.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/atRecibosParser.ts)
- [ATRecibosImporter.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/modelo10/ATRecibosImporter.tsx)
- [atRecibosParser.test.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/__tests__/atRecibosParser.test.ts)

## O que o preview da app deve mostrar

O importador de `Modelo 10` usa uma regra mais apertada do que o agregado bruto da AT:
- so entra `situacao = Emitido`
- so entra `retenção > 0`
- o preview agrega por `NIF do emitente`

### Preview esperado 2025

- `2608` documentos emitidos no total
- `106` emitidos sem retenção ficam de fora
- `2502` documentos entram no preview/import
- `144` beneficiarios seriam importados para `tax_withholdings`
- `bruto no preview = 4.396.821,33 €`
- `retenção no preview = 1.013.911,80 €`

### Preview esperado 2026

- `442` documentos emitidos no total
- `15` emitidos sem retenção ficam de fora
- `427` documentos entram no preview/import
- `99` beneficiarios seriam importados para `tax_withholdings`
- `bruto no preview = 943.097,31 €`
- `retenção no preview = 216.718,94 €`

## O que ainda falta para dizer "esta fechado"

Faltam 3 coisas:

1. Importacao de validacao do CAAD `2025`
- nao diretamente para declaracao final
- primeiro para preview e review

2. Comparacao com o trabalho manual da contabilidade
- total por ano
- total por beneficiario
- amostra documento a documento

3. Runbook para a contabilidade
- qual export sacar da AT
- como importar no IVAzen
- como rever divergencias
- como promover para `tax_withholdings`

## Fluxo recomendado para a contabilidade

Para cliente empresa como o CAAD:

1. Portal AT  
`Faturas e Recibos -> Consultar -> Bens ou Servicos Adquiridos`

2. Extrair o periodo em CSV oficial

3. Importar no IVAzen pelo importador de `Modelo 10`

4. Rever:
- documentos anulados
- beneficiarios
- totais por NIF
- retenções

5. So depois promover para dados finais da declaracao

## Proximo passo recomendado

O proximo passo certo e este:
- importar `CAAD 2025` para uma camada de preview/review
- comparar com o trabalho manual da contabilidade
- se bater, usar isso como prova de que o caminho `AT -> IVAzen -> Modelo 10` funciona

Nao recomendo saltar ja para declaracao final sem essa reconciliacao.
