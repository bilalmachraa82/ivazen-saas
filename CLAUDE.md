# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**IVAzen** - A SaaS tax management application for Portuguese businesses and accountants. Handles invoice classification, VAT (IVA) calculations, tax withholding management (Modelo 10), and fiscal reporting.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Start development server (localhost:8080)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Run E2E tests (Playwright)
npm test

# Run unit tests (Vitest)
npx vitest

# Run a single E2E test file
npx playwright test e2e/upload.spec.ts

# Run unit tests with watch mode
npx vitest --watch
```

## Architecture

### Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui (Radix primitives)
- **State**: React Query (server state) + React Context (auth/accountant)
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- **AI**: Gemini via OpenRouter for invoice OCR and classification

### Key Directories
- `src/pages/` - Page components (25 pages including Dashboard, Upload, Validation, Modelo10)
- `src/components/` - UI components organized by feature (upload/, modelo10/, accountant/, etc.)
- `src/hooks/` - Custom React hooks (useAuth, useInvoices, useWithholdings, etc.)
- `src/lib/` - Utilities (nifValidator, vatCalculator, bulkProcessor, etc.)
- `supabase/functions/` - Edge functions for AI processing (extract-invoice-data, classify-invoice, extract-withholding, parse-qr)
- `supabase/migrations/` - Database schema migrations
- `e2e/` - Playwright E2E tests

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

### Multi-User Architecture
- **Regular users**: Manage their own invoices and withholdings
- **Accountants**: Manage multiple clients via `useClientManagement` hook
- **Admins**: System-wide access via admin pages
- RLS (Row Level Security) policies enforce data isolation

## Key Patterns

### Client ID Handling
For accountant flows, a `selectedClientId` is passed through components:
```tsx
// In pages (e.g., Modelo10.tsx)
selectedClientId={isAccountant ? selectedClientId : user?.id}

// In hooks (e.g., useWithholdings)
const effectiveClientId = forClientId || user?.id;
```

### Edge Function Invocation
```tsx
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { /* params */ }
});
```

### Portuguese NIF Validation
Use `validatePortugueseNIF()` from `src/lib/nifValidator.ts` - validates 9-digit NIF with checksum.

## Testing

- **E2E Tests**: Playwright with desktop/mobile Chrome configurations
- **Unit Tests**: Vitest for lib utilities (nifValidator, modelo10, etc.)
- **Test Fixtures**: `e2e/fixtures/` for test data

## Environment Variables

Required in `.env`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key

Edge functions require:
- `AI_API_KEY` - For OpenRouter AI gateway access
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - Auto-injected by Supabase

## Portuguese Tax Context

- **IVA**: Portuguese VAT with rates 6% (reduced), 13% (intermediate), 23% (standard)
- **NIF**: 9-digit tax identification number with checksum validation
- **ATCUD**: Unique document identifier (mandatory since 2022)
- **Modelo 10**: Annual tax withholding declaration form
- **Income Categories**: A (dependent work), B (self-employed), E (capital), F (real estate), G (capital gains), H (pensions), R (IRC)
- **Fiscal Regions**: Continental (C), Açores (RA), Madeira (RM)

## Common Issues

### Supabase Types Out of Sync
After database migrations, types in `src/integrations/supabase/types.ts` may need regeneration via `supabase gen types typescript`.

### PWA Caching
Development uses service worker; clear cache or use incognito for fresh testing.
