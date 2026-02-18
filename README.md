# IVAzen — Gestão Fiscal Inteligente para Portugal 🇵🇹

SaaS de gestão fiscal para empresas e contabilistas portugueses. Classifica faturas, calcula IVA, gere retenções na fonte (Modelo 10), e automatiza declarações fiscais com IA.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- **AI**: Gemini via OpenRouter (classificação de faturas, extração OCR)
- **PWA**: Service Worker com cache offline

## Começar

```bash
# Instalar dependências
npm install

# Dev server (localhost:8080)
npm run dev

# Build de produção
npm run build

# Testes
npm run test         # Unit tests (Vitest)
npm run e2e          # E2E tests (Playwright)
```

## Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

Edge Functions (configurar no Supabase Dashboard > Edge Functions > Secrets):
```env
AI_API_KEY=your-openrouter-api-key
SUPABASE_URL=auto-injected
SUPABASE_ANON_KEY=auto-injected
```

## Funcionalidades

- 📄 Upload e extração OCR de faturas (PDF/imagem/QR Code)
- 🤖 Classificação automática com IA (atividade/pessoal/mista)
- 📊 Cálculos de IVA (6%, 13%, 23%) por região fiscal
- 📋 Modelo 10 — gestão de retenções na fonte
- 👥 Multi-tenant: clientes e contabilistas
- 📈 Relatórios e exportação
- 🔄 Sincronização eFatura
- 📱 PWA com suporte offline

## Licença

Proprietary © IVAzen
