# Demo Script — IVAzen para Contabilistas
**Duração**: 10-15 min | **Data**: 9 Março 2026

---

## Setup prévio
- Abrir `ivazen.aiparati.pt` em Chrome (modo incógnito para evitar cache PWA)
- Login: conta de contabilista (Adélia ou Bilal)
- Ter 2-3 NIFs prontos para alternar

---

## Sequência da Demo

### 1. Dashboard — Visão da carteira (1 min)
**Mensagem-chave**: "Este é o ponto de partida — a visão geral da sua carteira de clientes."

- Mostrar o header "Visão geral da sua carteira"
- Mostrar o selector de cliente no sidebar
- Mostrar os stats cards (total facturas, pendentes, validadas)
- **NÃO mostrar**: FiscalDeadlines se estiver vazio

### 2. Selecionar Bilal (NIF 232945993) — Centro Fiscal (2 min)
**Mensagem-chave**: "Para cada cliente, o Centro Fiscal mostra tudo o que precisa saber num único ecrã."

- Selecionar Bilal no selector
- Ir para **Centro Fiscal**
- Mostrar:
  - Card de Compras: 761 facturas (100% classificadas)
  - Card de Vendas: 25 facturas, €18.172 de receita
  - Card de SS: cálculos automáticos a partir dos recibos verdes
- **Destaque**: "As 761 facturas estão todas classificadas. Só precisa validar as de menor confiança."
- **NÃO mostrar**: Modelo 10 (Bilal não tem retenções — é normal para ENI)

### 3. Compras — Validação com IA (2 min)
**Mensagem-chave**: "A IA classifica e você valida. Só as de baixa confiança precisam de atenção."

- Menu → **Compras**
- Filtrar por "Pendente" para mostrar os que precisam de atenção
- Abrir um exemplo, mostrar:
  - Classificação sugerida pela IA
  - Nível de confiança (%)
  - Botão de validar/corrigir
- Validar 1-2 facturas ao vivo
- **Destaque**: "Em vez de abrir cada factura no e-Fatura, aqui valida em 2 clicks."

### 4. Vendas — Recibos Verdes (1 min)
**Mensagem-chave**: "Os recibos verdes importados ficam aqui, prontos para SS e IVA."

- Menu → **Vendas**
- Mostrar as 25 facturas validadas do Bilal
- Mostrar o total de receita
- **Destaque**: "Importou o Excel do AT uma vez, e os dados alimentam SS e IVA automaticamente."

### 5. Trocar para CAAD (NIF 508840309) — Modelo 10 (3 min)
**Mensagem-chave**: "Para clientes com muitas retenções, o Modelo 10 é onde o IVAzen brilha."

- Trocar cliente para CAAD no selector
- Menu → **Modelo 10**
- Mostrar:
  - 3.040 retenções importadas (2.608 de 2025 via SIRE + 427 de 2026)
  - Lista por beneficiário, NIF, categoria
  - Filtros por categoria de rendimento (A, B, E, F, G, H)
- **Destaque**: "Importou o ficheiro SIRE e ficou com 3.040 retenções classificadas. Isto substituiu semanas de trabalho manual."
- **NÃO mostrar**: SS do CAAD (empresa, não ENI — não aplicável)

### 6. Reconciliação (1 min)
**Mensagem-chave**: "A reconciliação cruza automaticamente os dados do AT com os dados na app."

- Menu → **Obrigações Fiscais** → **Reconciliação** (nova localização!)
- Mostrar o painel de reconciliação do CAAD
- **Destaque**: "Se houver divergências, aparecem aqui com o delta exacto."

### 7. Importação (1 min)
**Mensagem-chave**: "Tudo começa pela importação — SIRE, recibos verdes, ou upload manual."

- Menu → **Importação** → **Centro de Importação**
- Mostrar as opções disponíveis
- **Destaque**: "Um ficheiro CSV do AT e o IVAzen faz o resto."

### 8. Segurança Social — Bilal (2 min)
**Mensagem-chave**: "O cálculo de SS é automático a partir dos recibos verdes."

- Voltar para Bilal
- Menu → **Segurança Social**
- Mostrar:
  - Tabela de rendimentos por categoria e coeficiente
  - Cálculo da base tributável
  - Contribuição estimada por trimestre
- **Destaque**: "Q2-2025 teve €6.989 de receita → contribuição estimada de €348. Isto antes era uma hora de Excel."
- **Se SS estiver vazio**: "Ainda não tem declarações guardadas — o próximo passo é importar os recibos e guardar."

### 9. Encerrar — Sidebar simplificado (30 seg)
**Mensagem-chave**: "O menu está organizado pelo fluxo de trabalho: importar, classificar, obrigações, análise."

- Mostrar o sidebar simplificado (sem ruído)
- Mostrar que Reconciliação está agora em Obrigações Fiscais
- **Destaque**: "Tudo o que precisa, sem distrações."

---

## O que EVITAR mostrar

| Ecrã | Razão |
|------|-------|
| Painel Contabilista (/accountant) | Já não está no sidebar — funcionalidade de gestão, não de demo |
| Glossário / Calculadora IVA | Escondidos — utilitários, não core |
| SS do CAAD | CAAD é empresa, SS não aplicável |
| Compras do CAAD | 1.958 classificadas mas sem nomes de fornecedor — preferir Modelo 10 |
| Majda | Usar apenas se perguntarem "e um ENI mais pequeno?" — 123 facturas pending, 22 vendas |
| Apuramento sem dados | Mostrar apenas se o Bilal tiver compras suficientes classificadas |

---

## Como explicar clientes vazios

Se durante a demo um ecrã aparecer vazio:

> "Este cliente ainda não tem [dados importados / recibos verdes / retenções].
> No dia-a-dia, a contabilista importa o ficheiro do AT aqui [apontar para CTA]
> e o IVAzen processa tudo automaticamente.
> Vamos ver um cliente com dados completos para demonstrar."

**Alternativa curta**: "Isto é o estado zero — o próximo passo seria importar aqui."

---

## Dados confirmados para demo

| Cliente | Compras | Vendas | SS | Modelo 10 | Melhor para mostrar |
|---------|---------|--------|----|-----------|-------------------|
| **Bilal** | 761 (100% class.) | 25 (€18.172) | Cálculos | 0 | IVA + SS + Validação IA |
| **CAAD** | 1.958 (100% class.) | 968 (€4.3M) | N/A | 3.040 | Modelo 10 + Reconciliação |
| **Majda** | 123 (pending) | 22 (€3.157) | Cálculos | 0 | Backup ENI |

---

*Preparado: 9 Março 2026 | IVAzen v11a49b3+*
