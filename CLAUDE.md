# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /review, /ship, /browse, /qa, /qa-only, /design-review,
/setup-browser-cookies, /retro, /debug, /document-release.

## Project Overview

**IVAzen** — SaaS tax management for Portuguese businesses and accountants. Invoice classification, VAT (IVA) calculations, tax withholding management (Modelo 10), and fiscal reporting.

## Build & Development Commands

```bash
npm install                              # Install dependencies
npm run dev                              # Dev server at localhost:8080
npm run build                            # Production build
npm run preview                          # Preview production build
npm run lint                             # ESLint

# Unit tests (Vitest, jsdom environment)
npm test                                 # Run all unit tests once
npm run test:watch                       # Watch mode
npx vitest src/lib/__tests__/nifValidator.test.ts  # Single file

# E2E tests (Playwright, requires dev server running)
npm run e2e                              # All E2E tests
npx playwright test e2e/upload.spec.ts   # Single E2E file
```

## Architecture

### Stack
- **Frontend**: React 18 + TypeScript + Vite (SWC) — deployed on Vercel
- **Styling**: Tailwind CSS 3 + shadcn/ui (Radix primitives)
- **State**: React Query (server state) + React Context (auth via `useAuth`, client selection via `useSelectedClient`)
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth + Storage + RLS)
- **AI**: Gemini via OpenRouter for invoice OCR and classification
- **AT Connector**: Separate Node.js microservice (`services/at-connector/`) for AT e-Fatura SOAP/mTLS — runs on VPS, not Supabase

### Path Alias
`@/` resolves to `src/` (configured in `tsconfig.json` and `vite.config.ts`). Always use `@/` for imports.

### TypeScript Configuration
`strictNullChecks` and `noImplicitAny` are **off**. Code does not assume strict null safety.

### Key Directories
- `src/pages/` — Route-level page components (~31 pages)
- `src/components/` — Feature-organized: `upload/`, `modelo10/`, `accountant/`, `landing/`, `sales/`, `ui/` (shadcn), etc.
- `src/hooks/` — Custom hooks (~43 hooks for auth, data fetching, PWA, offline, etc.)
- `src/lib/` — Pure utilities and business logic (NIF validation, VAT calculation, fiscal periods, PDF/Excel generation, parsers)
- `src/lib/__tests__/` — Vitest unit tests for lib utilities
- `src/integrations/supabase/` — Auto-generated Supabase client and types
- `supabase/functions/` — Deno Edge Functions (17 functions: AI extraction, QR parsing, eFatura sync, etc.)
- `supabase/migrations/` — Database schema migrations
- `services/at-connector/` — Standalone Node.js service for AT SOAP API (mTLS)
- `e2e/` — Playwright E2E tests

### Provider Nesting (App.tsx)
`ErrorBoundary > ThemeProvider > QueryClientProvider > TooltipProvider > AuthProvider > SelectedClientProvider > BrowserRouter`

All hooks that depend on auth (`useAuth`) or client selection (`useSelectedClient`) must be used within pages/components inside this tree.

### Data Flow

**Invoice Upload Flow:**
1. User uploads image/PDF → `src/pages/Upload.tsx`
2. QR code parsing (Portuguese format) → `supabase/functions/parse-qr/`
3. Or AI extraction for non-QR docs → `supabase/functions/extract-invoice-data/`
4. AI classification (VAT deductibility) → `supabase/functions/classify-invoice/`
5. Store in `invoices` table with classifications
6. Manual validation → `src/pages/Validation.tsx`

**Modelo 10 (Tax Withholding) Flow:**
1. Bulk upload documents → `src/components/modelo10/BulkUploadTab.tsx`
2. AI extraction → `supabase/functions/extract-withholding/`
3. Confidence scoring → `src/lib/bulkProcessor.ts`
4. Review & approve → `src/components/modelo10/BulkReviewTable.tsx`
5. Store in `tax_withholdings` table

### Multi-User Architecture (Roles)
- Roles stored in `user_roles` table, fetched in `useAuth` → `roles: AppRole[]` where `AppRole = 'client' | 'accountant' | 'admin'`
- `ProtectedRoute` component gates routes by role via `requireRole` prop
- **Accountant flows**: `selectedClientId` from `useSelectedClient` context is passed through components. In hooks, pattern is: `const effectiveClientId = forClientId || user?.id;`
- RLS (Row Level Security) policies enforce data isolation at the database level

## Key Patterns

### Edge Function Invocation
```tsx
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { /* params */ }
});
```

### Design Tokens
Centralized in `src/lib/design-tokens.ts`. Primary palette: Rose Pink (hsl 335). Fonts: Inter (body), Poppins (display).

### Portuguese NIF Validation
Use `validatePortugueseNIF()` from `src/lib/nifValidator.ts` — validates 9-digit NIF with checksum.

## Testing

- **Unit tests** (`src/lib/__tests__/`): Vitest with jsdom, covers NIF validation, VAT calculations, fiscal periods, PDF generation, parsers
- **E2E tests** (`e2e/`): Playwright with Desktop Chrome + Mobile Chrome (Pixel 5), baseURL `http://localhost:8080`
- **Test fixtures**: `e2e/fixtures/`

## Environment Variables

Required in `.env`:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key

Edge functions (set in Supabase Dashboard > Edge Functions > Secrets):
- `AI_API_KEY` — OpenRouter API key
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — Auto-injected by Supabase

Build-time defines (automatic): `__BUILD_COMMIT__`, `__BUILD_TIME_ISO__`

## Portuguese Tax Context

- **IVA**: VAT with rates 6% (reduced), 13% (intermediate), 23% (standard)
- **NIF**: 9-digit tax ID with checksum validation
- **ATCUD**: Unique document identifier (mandatory since 2022)
- **Modelo 10**: Annual tax withholding declaration form
- **Income Categories**: A (dependent work), B (self-employed), E (capital), F (real estate), G (capital gains), H (pensions), R (IRC)
- **Fiscal Regions**: Continental (C), Açores (RA), Madeira (RM)

## Common Issues

### Supabase Types Out of Sync
After database migrations, regenerate types: `supabase gen types typescript > src/integrations/supabase/types.ts`

### PWA Caching
Service worker caches aggressively. Clear cache or use incognito for fresh testing during development.

### Vercel SPA Routing
`vercel.json` has a catch-all rewrite to `index.html` for React Router. New routes need only be added to `App.tsx`.
