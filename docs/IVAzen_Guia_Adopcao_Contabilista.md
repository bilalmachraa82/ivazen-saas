# IVAzen — Guia de Adoção para Contabilistas

## O que fazia antes

| Tarefa | Método tradicional |
|--------|-------------------|
| Classificar compras | Abrir cada factura no e-Fatura, copiar NIF, procurar no Primavera, classificar manualmente |
| Preencher DP IVA | Exportar CSV do AT, cruzar com contabilidade, preencher campo a campo no portal |
| Modelo 10 | Pedir documentos ao cliente, extrair dados de PDFs, preencher linha a linha |
| Segurança Social | Somar recibos verdes manualmente, aplicar coeficientes, calcular base tributável |
| Conferir dados | Cruzar portal AT com software de gestão, excel intermédio, muito copy-paste |

**Resultado**: horas por cliente/trimestre, elevado risco de erro, sem visão consolidada.

---

## O que faz agora no IVAzen

| Tarefa | No IVAzen |
|--------|-----------|
| Classificar compras | IA classifica automaticamente (>80% confiança), contabilista valida os restantes |
| Preencher DP IVA | Apuramento automático com totais por taxa IVA, exportável para Excel/PDF |
| Modelo 10 | Importação SIRE do AT, extração automática, reconciliação AT vs manual |
| Segurança Social | Calcula base tributável a partir dos recibos verdes com coeficientes oficiais |
| Conferir dados | Tab de Reconciliação cruza AT, OCR e cálculos automaticamente |

**Resultado**: minutos por cliente/trimestre, conferência automática, alertas de divergência.

---

## Como começar (1.ª utilização)

### 1. Aceder ao IVAzen
- URL: **ivazen.aitipro.com**
- Login com email e password fornecidos

### 2. Selecionar o cliente
- No menu lateral, o selector "Cliente Activo" mostra todos os clientes associados
- Selecionar o NIF pretendido
- O badge de tipo (ENI / Empresa) aparece automaticamente

### 3. Verificar o Centro Fiscal
- Menu → **Centro Fiscal**
- Mostra o estado de cada obrigação: compras, vendas, SS, Modelo 10
- Identifica o que falta: facturas por classificar, retenções por rever, divergências

### 4. Importar dados do AT
- Menu → **Importação** → **Centro de Importação**
- Opções:
  - **Ficheiro SIRE** (CSV exportado do AT) — para compras e retenções
  - **Recibos Verdes** (Excel do portal AT) — para vendas/SS
  - **Upload manual** de PDFs — para documentos avulsos

---

## Como trabalhar IVA (Declaração Periódica)

1. **Importar compras** → Centro de Importação (SIRE CSV ou upload manual)
2. **Validar classificações** → Menu → Compras
   - A IA classifica automaticamente com indicação de confiança
   - Filtrar por "Pendente" ou "Baixa Confiança" para rever
   - Validar ou corrigir a classificação
3. **Verificar vendas** → Menu → Vendas
   - Confirmar que os recibos verdes estão importados
   - Validar a categoria de rendimento
4. **Gerar apuramento** → Menu → Apuramento
   - Totais por taxa IVA (6%, 13%, 23%)
   - Exportar para Excel ou PDF

---

## Como trabalhar Segurança Social

1. **Importar recibos verdes** → Importação → carregar Excel do portal AT
2. **Abrir SS** → Menu → Segurança Social
3. **Selecionar trimestre** → os cálculos são automáticos:
   - Rendimento bruto por categoria
   - Coeficiente aplicável (ex: 70% para prestação de serviços)
   - Base tributável
   - Contribuição a pagar (taxa 21,4% independente)
4. **Nota**: o trimestre N determina as contribuições do trimestre N+1

---

## Como trabalhar Modelo 10

1. **Importar SIRE** → Centro de Importação → ficheiro CSV do AT
2. **Abrir Modelo 10** → Menu → Modelo 10 (Retenções)
3. **Verificar retenções** → lista por beneficiário, NIF, categoria, montante
4. **Reconciliar** → Tab de reconciliação cruza dados AT vs manual
5. **Exportar** → PDF por beneficiário ou ficheiro completo

---

## O que fazer quando o cliente não tem dados

| Situação | O que fazer |
|----------|-------------|
| Sem facturas importadas | Importar via Centro de Importação (SIRE ou upload) |
| Sem recibos verdes | Pedir ao cliente o Excel do portal AT (emitir factura → consultar) |
| Sem credenciais AT | Pedir NIF + password do portal AT ao cliente |
| Sem retenções | Normal se o cliente não tem rendimentos sujeitos a retenção |
| Dados desactualizados | Re-importar o ficheiro SIRE mais recente |

---

## Atalhos úteis

- **Cmd+K** (ou Ctrl+K) — Pesquisa rápida / paleta de comandos
- **Centro Fiscal** — resumo completo do cliente
- **Reconciliação** — visão cruzada AT vs App (em Obrigações Fiscais)

---

*IVAzen — Gestão fiscal inteligente para contabilistas portugueses*
