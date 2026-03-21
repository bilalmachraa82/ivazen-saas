# CAAD Modelo 10 via AT

> Nota: este documento ficou como registo da exploracao inicial.  
> O estado reconciliado e atualizado esta em [CAAD_RECONCILIACAO_AT_2026-03-07.md](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/docs/CAAD_RECONCILIACAO_AT_2026-03-07.md).

Data: 2026-03-07
Cliente: `CAAD-Centro de Arbitragem Administrativa`
NIF: `508840309`

## Objetivo

Validar se o IVAzen consegue suportar `Modelo 10` para clientes empresa usando a exportação oficial da AT, sem depender de upload massivo de PDFs.

## O que foi confirmado no portal AT

O login no portal `Faturas e Recibos` do CAAD funcionou.

Para `Modelo 10` empresa, a origem correta é:
- `Faturas e Recibos -> Consultar -> Bens ou Serviços Adquiridos`

O portal atual usa endpoints internos HTTP úteis:
- `GET /recibos/api/obtemDocumentosV2`
- `GET /recibos/api/exportConsultaExcel`

Isto é relevante porque permite automação baseada em dados estruturados da própria AT, em vez de scraping de DOM ou OCR documento a documento.

## Volume real confirmado

Consulta anual `2025-01-01` a `2025-12-31` no portal AT do CAAD:
- `totalDocs = 2697`
- `totalBase = 4.569.023,74`
- `totalIrs = 1.013.911,80`
- `totalIva = 1.035.496,23`

Limitação operacional importante:
- o export `CSV` da AT vem limitado a `800` linhas por chamada
- a automação tem de paginar por `offset`

## O que foi implementado no IVAzen

Foi adicionado suporte ao CSV atual da AT com retenções do lado dos `documentos adquiridos` no importador de `Modelo 10`.

Ficheiros alterados:
- [src/lib/atRecibosParser.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/atRecibosParser.ts)
- [src/components/modelo10/ATRecibosImporter.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/modelo10/ATRecibosImporter.tsx)
- [src/lib/__tests__/atRecibosParser.test.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/__tests__/atRecibosParser.test.ts)

O parser agora:
- continua a bloquear CSV AT sem retenções
- continua a bloquear CSV AT de `vendas emitidas` para não misturar o fluxo do ENI
- aceita CSV AT de `documentos adquiridos` com retenções
- suporta casas decimais a `3` dígitos (`130,787`)
- normaliza headers com problemas de encoding (`ReferÃªncia`, `SituaÃ§Ã£o`, etc.)

## Validação real com ficheiro oficial

Ficheiro exportado do portal:
- `/Users/bilal/Programaçao/ivazen-saas/output/at-recibos/CAAD_508840309_2025_export.csv`

Resultado do parser no primeiro chunk exportado:
- `records = 751`
- `uniqueNifs = 109`
- `totalBruto = 1.366.777,42`
- `totalRetencao = 315.156,172`

Notas:
- o CSV exportado pela AT tinha `800` linhas
- `17` documentos com retenção foram ignorados por estado inválido ou dados incompletos
- os totais acima são apenas do primeiro chunk, não do ano inteiro

## Implicação de produto

Para clientes empresa como o CAAD:
- `Modelo 10` não deve depender do pipeline `sales_invoices`
- o caminho correto é `AT adquiridos -> parser estruturado -> review -> tax_withholdings`

Para ENI:
- continuar a usar `vendas/recibos verdes -> SS`
- e, quando aplicável, retenções no fluxo de vendas importadas

## Próximo passo recomendado

1. Criar paginação automática do export AT por `offset`:
   - `0`
   - `800`
   - `1600`
   - `2400`

2. Juntar todos os chunks num único dataset anual.

3. Ligar esse dataset a um fluxo de review antes de inserir em `tax_withholdings`.

4. Separar no produto o tipo fiscal do cliente:
   - `eni`
   - `company`

Sem esta separação, o produto continua a misturar `SS` com `Modelo 10` em clientes onde isso não faz sentido.
