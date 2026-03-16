# IVAzen — Handoff Operacional Final

Data: `2026-03-15`
Versão: `BLOCO 5` — consolida e substitui docs anteriores de handoff.

---

## 1. Veredicto

O IVAzen está **pronto para demo guiada e uso real em clientes com dados carregados**.

A carteira completa **não está homogénea**. O principal gap não é o produto; é a **readiness operacional da carteira** (credenciais AT, importação inicial, classificação de dados).

### Mensagem para a cliente

> O IVAzen já está pronto para trabalhar com clientes que tenham dados carregados e para demonstrar um fluxo completo de IVA, Segurança Social e Modelo 10. Para utilização plena em toda a carteira, ainda é necessário completar a readiness operacional de alguns clientes, sobretudo ao nível de credenciais AT e importação inicial de dados.

---

## 2. O que está pronto (produto)

| Módulo | Estado | Notas |
|--------|--------|-------|
| Dashboard / Carteira | Pronto | Readiness badges por cliente, "Como Começar" para contabilistas |
| Centro Fiscal | Pronto | Hub do cliente com status por obrigação, inbox, período/ano |
| Compras (Validação) | Pronto | IA classifica automaticamente, filtros, bulk reclassify |
| Vendas | Pronto | Lista, validação, stats |
| Segurança Social | Pronto | Cálculo automático por trimestre, coeficientes centralizados |
| Modelo 10 (Retenções) | Pronto | Import SIRE, candidatos auto-detectados, reconciliação AT, export |
| Reconciliação | Pronto | 4 tabs: Compras AT vs App, Modelo 10, SS, Auditoria avançada |
| Apuramento / Exportação | Pronto | Totais por taxa IVA, edição deductibilidade, Excel/PDF |
| Centro de Importação | Pronto | 5 canais com health tracking e recomendações |
| Upload (Single/Bulk/SAFT) | Pronto | OCR+IA, QR scan, até 3000 ficheiros bulk, feedback semântico |
| Guia do Contabilista | Pronto | In-app em `/guide`, SOP integrado, atalhos, clientes referência |
| AT Control Center | Pronto | Monitorização sync, health por cliente (feature flag) |

### Qualidade técnica
- Build de produção: passa (125 entries, code-split)
- Testes automatizados: 834/834 pass (36 ficheiros)
- PWA: instalável como app nativa
- Segurança: CSP, HSTS, RLS em todas as tabelas

---

## 3. Clientes de referência

### Para formação e demo

| Cliente | NIF | Tipo | Usar para | Dados |
|---------|-----|------|-----------|-------|
| **Bilal Machraa** | `232945993` | ENI | Centro Fiscal + Compras + Vendas + SS | 761 compras, 25 vendas |
| **CAAD** | `508840309` | Empresa | Modelo 10 + Reconciliação | 3040 retenções |
| **Justyna Rogers** | `307170730` | ENI | IVA com período correcto | Período completo |

### Backup
| Cliente | NIF | Tipo | Notas |
|---------|-----|------|-------|
| Majda Machraa | `232946060` | ENI | 123 compras, 22 vendas — caso secundário, não usar como principal |

### O que evitar na demo
- Clientes aleatórios sem dados
- Sync AT live
- Compras do CAAD (nomes fornecedor incompletos em parte dos dados)
- Prometer que toda a carteira já está sincronizada

---

## 4. Fluxo padrão por cliente

### Regra de ouro

> Se há dados, trabalha-se a partir do **Centro Fiscal**.
> Se não há dados, o próximo passo é **Importação** ou **AT Control Center**.

### 9 passos

1. Escolher cliente no **Dashboard** (menu lateral)
2. Abrir **Centro Fiscal** — hub do cliente
3. Se faltarem dados → **Centro de Importação** ou **AT Control Center**
4. **Compras** → validar classificação IA
5. **Vendas** → confirmar receitas / recibos verdes
6. **Segurança Social** → quando aplicável (ENI)
7. **Modelo 10** → retenções na fonte
8. **Reconciliação** → cruzar dados AT vs app
9. **Apuramento / Exportação** → gerar ficheiros

---

## 5. Como trabalhar cada obrigação

### IVA (Declaração Periódica)

1. Importar compras → Centro de Importação (SIRE CSV ou upload manual)
2. Validar classificações → **Compras** — IA classifica, filtrar por "Pendente" ou "Baixa Confiança"
3. Verificar vendas → confirmar recibos verdes importados
4. Gerar apuramento → totais por taxa IVA (6%, 13%, 23%), exportar Excel/PDF

### Segurança Social

1. Importar recibos verdes → carregar Excel do portal AT
2. Abrir **Segurança Social**
3. Selecionar trimestre → cálculos automáticos (rendimento bruto, coeficiente, base tributável)
4. Taxa 21,4% independente. Trimestre N determina contribuições de N+1

**Nota:** aplica-se a ENI / trabalhadores independentes.

### Modelo 10 (Retenções)

1. Importar SIRE → Centro de Importação → ficheiro CSV do AT
2. Abrir **Modelo 10**
3. Verificar retenções → lista por beneficiário, NIF, categoria, montante
4. Reconciliar → cruzar dados AT vs manual
5. Exportar → PDF por beneficiário ou ficheiro completo

---

## 6. Métodos de importação

| Método | Quando usar | Destino na app |
|--------|-------------|----------------|
| SIRE CSV (AT) | Compras e retenções oficiais | Centro de Importação |
| Recibos Verdes Excel (AT) | Vendas / Segurança Social | Centro de Importação |
| Upload manual (PDF/imagem) | Documentos avulsos, OCR + IA | Carregar Faturas |
| SAFT-PT (XML) | Software de facturação (Primavera, Sage) | Carregar Faturas → tab SAFT |
| Upload em Bulk | Muitos ficheiros de uma vez (até 3000) | Carregar Faturas → tab Bulk |

**O que não funciona como import automático:**
- Recibos verdes via SOAP API — o portal AT **não os disponibiliza** por API. O caminho é Excel manual.
- Sync AT generalizado para toda a carteira — depende de credenciais funcionais por cliente.

---

## 7. Cliente sem dados — o que fazer

| Situação | Acção |
|----------|-------|
| Sem facturas importadas | Importar via Centro de Importação (SIRE ou upload) |
| Sem recibos verdes | Pedir ao cliente o Excel do portal AT |
| Sem credenciais AT | Pedir NIF + password do portal AT ao cliente |
| Sem retenções | Normal se o cliente não tem rendimentos sujeitos a retenção |
| Dados desactualizados | Re-importar o ficheiro SIRE mais recente |

**Regra:** não assumir bug. Confirmar: há credenciais? há dados importados? o período está correcto?

---

## 8. Estado da carteira (Adélia)

Total de clientes: **405**

| Estado | Quantidade | O que significa | O que fazer |
|--------|-----------|-----------------|-------------|
| **Prontos** | 32 | Dados carregados, trabalhar normalmente | Usar Centro Fiscal |
| **Parciais** | 220 | Dados existentes, contexto AT imperfeito | Trabalhar com cautela, validar origem |
| **Sem dados** | 18 | Sem dados contabilísticos, sem bloqueio técnico | Importar antes de trabalhar |
| **Sem credenciais** | 9 | Sem credenciais AT registadas | Pedir credenciais ao cliente |
| **Bloqueados** | 126 | Erro técnico/operacional (auth, schema, etc.) | Resolver credenciais/AT antes |

### Regras operacionais
- A equipa **não deve começar por clientes aleatórios**
- Começar pelos 32 prontos, depois expandir para parciais após validação
- `AT_EMPTY_LIST` não significa erro — pode significar ausência de documentos no canal consultado
- Esta classificação é operacional, não jurídica

---

## 9. Checklist de arranque da equipa

### Dia 1
- [ ] Login em **ivazen.aitipro.com** com credenciais fornecidas
- [ ] Abrir **Dashboard** — ver "Estado da Carteira" (readiness badges)
- [ ] Ler o **Guia** (menu lateral → Sistema → Guia)
- [ ] Abrir cliente **Bilal Machraa** → Centro Fiscal → percorrer Compras, Vendas, SS
- [ ] Abrir cliente **CAAD** → Modelo 10 → ver retenções e reconciliação
- [ ] Experimentar importação: carregar 1 ficheiro teste via Upload
- [ ] Testar exportação: gerar apuramento IVA para 1 período

### Primeira semana
- [ ] Trabalhar 3-5 clientes "Prontos" do início ao fim (Centro Fiscal → Exportação)
- [ ] Importar dados de 2-3 clientes "Parciais" via Centro de Importação
- [ ] Testar fluxo SS com 1 cliente ENI
- [ ] Testar fluxo Modelo 10 com 1 cliente empresa
- [ ] Usar Reconciliação para cruzar dados AT vs app em pelo menos 1 cliente
- [ ] Reportar dúvidas ou bloqueios encontrados

---

## 10. O que dizer vs não dizer

### Dizer
- "O IVAzen trabalha com clientes que tenham dados carregados"
- "A importação do AT funciona por SIRE CSV ou Excel oficial"
- "A IA classifica automaticamente mas a validação final é do contabilista"
- "O Guia dentro da app tem o SOP completo"

### NÃO dizer
- ~~"Todos os clientes sincronizam automaticamente"~~
- ~~"Recibos verdes são recolhidos automaticamente"~~
- ~~"A carteira inteira está pronta sem importação manual"~~
- ~~"O sync AT é 100% fiável para toda a carteira"~~

---

## 11. Atalhos úteis

| Atalho | Acção |
|--------|-------|
| `Cmd+K` | Pesquisa rápida / paleta de comandos |
| `Shift+?` | Ver todos os atalhos de teclado |
| `g → d` | Dashboard |
| `g → v` | Compras (Validação) |
| `g → s` | Vendas |
| `g → u` | Upload |

---

## 12. Acessos e infraestrutura

| Componente | URL/Acesso |
|------------|------------|
| App (produção) | `https://ivazen.aitipro.com` |
| Repositório | `github.com/bilalmachraa82/ivazen-saas` |
| Supabase | Projeto `dmprkdvkzzjtixlatnlx` (Frankfurt) |
| AT Connector (VPS) | `137.74.112.68:8788` (Caddy proxy) |

---

## 13. O que falta para 100%

### P0 — Antes de dizer "entregue"

| Item | Estado | Acção |
|------|--------|-------|
| Push do handoff final | **FEITO** | — |
| Sentry DSN em produção | **Por verificar** | Confirmar `VITE_SENTRY_DSN` no Vercel. Sem isto, erros em produção são invisíveis. |
| Teste real de export no portal AT | **Por fazer** | Gerar 1 apuramento IVA e 1 export Modelo 10 e submeter/validar no fluxo AT real. O código gera o formato, mas não está validado por aceitação. |
| Operacionalizar suporte | **Montado** | ChatWidget (`suporte@ivazen.pt`) visível em todas as páginas autenticadas (FAQ + formulário + links úteis). Falta: definir quem responde e SLA. |
| Documentar recovery de dados | **Por fazer** | Procedimento para recuperar facturas/dados apagados acidentalmente. Supabase faz backups, mas a equipa não sabe como pedir restore. |
| Smoke test live pós-push | **Por fazer** | Alguém percorre 3 clientes × 3 obrigações no live (`ivazen.aitipro.com`) para confirmar que o deploy está funcional. |

### P1 — Primeira semana

| Item | Estado | Acção |
|------|--------|-------|
| Badge universal de frescura | **Parcial** | `last_sync_at` existe em hooks (useClientFiscalCenter, ATControlCenter, BulkClientSync) mas não está visível como badge na carteira/journey principal. Gap: contabilista pode trabalhar com dados stale sem saber. |
| Lock de período fechado | **Não existe** | SS e Modelo 10 têm noção de estados mas não há lock transversal que impeça edição de facturas/classificações de períodos já declarados. **Gap mais sério do produto fiscal** — alteração acidental de dados submetidos é risco real. |
| Fluxo de update de credenciais AT | **Por verificar** | Quando clientes mudam passwords no portal AT, como se actualizam no IVAzen? Confirmar que o fluxo existe e não quebra silenciosamente. |
| Ownership e suporte operacional | **Parcial** | ChatWidget montado e visível. Falta definir: quem responde a `suporte@ivazen.pt`, SLA, e quem na equipa importa/pede credenciais/fecha período. |

### P2 — Primeiro mês

| Item | Estado | Acção |
|------|--------|-------|
| Proveniência visível por documento | **Não existe** | Quando há dados AT + manual + SAFT, a contabilista não vê claramente "qual é a fonte de verdade" por documento. `image_path` diferencia (saft-import/, at-sync/), mas não está surfaced na UI. |
| Alerting de negócio | **Não existe** | Sentry é para erros de código. Falta: "syncs falharam", "credenciais expiraram", "cliente stale há >30 dias". |
| Undo / recovery de acções destrutivas | **Não existe** | Reclassificação em massa errada, apagar facturas — não há undo. Não é backup; é procedimento operacional. |
| Concorrência / conflito entre contabilistas | **Não existe** | Se 2 contabilistas da mesma equipa abrirem o mesmo cliente e reclassificarem a mesma factura ao mesmo tempo, não há locking. RLS isola por accountant, mas dentro da mesma conta não há protecção. |
| Triage de carteira em massa | **Não existe** | Vista que mostra "126 precisam credenciais → acção bulk". Transformaria handoff de "arranja cada um" para "a app ajuda". |
| Drift de configuração entre ambientes | **Por verificar** | Não é só Sentry. Inclui: `AT_ENCRYPTION_KEY`, feature flags, config do VPS/connector. Gap real de entrega — o que está em dev pode não estar em prod. |

### P3 — Trimestre

| Item | Estado |
|------|--------|
| Release guardrails (CI/CD) | Fraco — GitHub Actions existe mas token pode não ter scope `workflow` |
| Product analytics | Não existe — sem Mixpanel/PostHog, churn é descoberto tarde |
| Billing / Stripe | Só relevante para SaaS self-serve; Adélia resolve com facturação directa |
| RGPD DPA | Por verificar — DPA com sub-processadores (Supabase, Vercel, OVH) |
| a11y baseline | Não feito — pode ser requisito legal para contabilistas que servem entidades públicas |

### Fora de scope (decisão consciente)

- **Client self-service** — produto fechado como accountant-only. Role `client` existe na base mas não é gap do scope actual.

### Resumo executivo

> O que falta para 100% não é o core fiscal; é **governança operacional do produto**: dados frescos, períodos fechados, observabilidade, suporte, ownership e validação real do loop com a AT.

---

*Este documento consolida e substitui: HANDOFF_EQUIPE_CLIENTE, SOP_EQUIPE_CONTABILIDADE, IVAzen_Guia_Adopcao_Contabilista, CARTEIRA_ADELIA_READYNESS. Os anteriores ficam como arquivo histórico.*
