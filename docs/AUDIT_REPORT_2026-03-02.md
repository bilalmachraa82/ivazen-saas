# IVAzen SaaS — Full Audit Report (2026-03-02)

## 1. BUILD & TESTS

| Check | Result |
|-------|--------|
| `npm run build` | PASS — 7.70s, PWA generated (166 precache entries) |
| `npm test` (Vitest) | PASS — 23 files, **621/621 tests** |
| `npm run lint` (ESLint) | 1422 errors (mostly `no-explicit-any`) — pre-existing, not blocking |
| `check-edge-auth` | PASS — **8 functions verified**, zero insecure patterns |
| Production site (ivazen.aiparati.pt) | HTTP 200, 271ms, 3.9KB |

### Bundle Size (top chunks)

| Chunk | Size | Gzip |
|-------|------|------|
| index (core) | 547 KB | 164 KB |
| xlsx | 424 KB | 141 KB |
| jspdf | 388 KB | 126 KB |
| BarChart (recharts) | 374 KB | 103 KB |
| Modelo10 | 363 KB | 98 KB |

> 2 chunks exceed 500KB warning. Code splitting with React.lazy is applied but xlsx/jspdf are large dependencies.

---

## 2. SECURITY

### 2.1 Security Headers (Production)

| Header | Value | Status |
|--------|-------|--------|
| X-Content-Type-Options | nosniff | OK |
| X-Frame-Options | DENY | OK |
| X-XSS-Protection | 1; mode=block | OK |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload | OK |
| Referrer-Policy | strict-origin-when-cross-origin | OK |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | OK |

### 2.2 Edge Function Auth (Post-Patch)

| Endpoint | No Auth | Forged JWT `role=service_role` |
|----------|---------|-------------------------------|
| sync-efatura | 401 | 401 |
| fetch-efatura-portal | 401 | 401 |
| extract-invoice-data | 401 | 401 |
| reencrypt-credentials | 401 | 401 |

### 2.3 Findings by Severity

#### HIGH

| ID | Finding | Files |
|----|---------|-------|
| **H-1** | **Token comparison timing attack**: `token === supabaseServiceKey` (direct string compare, not constant-time). Works correctly now that JWT decode fallback was removed, but vulnerable to theoretical timing oracle. | sync-efatura, fetch-efatura-portal, extract-invoice-data, reencrypt-credentials, process-at-sync-queue |
| **H-2** | **IDOR in classify-invoice + classify-sales-category**: Uses service-role client to fetch any invoice by UUID without checking ownership (`client_id`). Any authenticated user can classify any other user's invoice. | classify-invoice/index.ts:214, classify-sales-category/index.ts:142 |
| **H-3** | **Deprecated auth pattern**: `fetch-efatura-portal` uses `supabase.auth.getUser(token)` on service-role client instead of creating anon-key client with user's Authorization header. | fetch-efatura-portal/index.ts:1541 |

#### MEDIUM

| ID | Finding | Files |
|----|---------|-------|
| **M-1** | **Wildcard CORS** (`Access-Control-Allow-Origin: *`) on 13 of 17 edge functions. Only 3 use restricted origin. | Most edge functions |
| **M-2** | **check-fiscal-deadlines** accessible by ANY authenticated user (not just admin/cron). Can trigger push notifications to all users. | check-fiscal-deadlines/index.ts:106 |
| **M-3** | `dangerouslySetInnerHTML` with developer-supplied CSS values in chart component. Latent vector if user-controlled data reaches it. | src/components/ui/chart.tsx:70 |

#### LOW

| ID | Finding | Files |
|----|---------|-------|
| **L-1** | 18 `console.log` statements remain in production src/ code. | BulkInvoiceUpload, useUploadQueue, reconciliationEngine, bulkInvoiceProcessor |
| **L-2** | Taxpayer NIFs logged in edge function console output (GDPR concern). | classify-invoice, import-client-credentials, fetch-efatura-portal |
| **L-3** | `parse-credentials-pdf` logs first 500 chars of AI output (may contain parsed credentials). | parse-credentials-pdf/index.ts:134 |
| **L-4** | `xlsx@0.18.5` — abandoned npm SheetJS package, no longer receiving security updates. | package.json |
| **L-5** | `create-client-direct` pins to `@supabase/supabase-js@2.39.3` (14 months old); other functions use `2.94.1`. | create-client-direct/index.ts:2 |

#### INFO (Positive Findings)

- Zero hardcoded secrets in source code
- No `VITE_` prefix exposing service keys to frontend
- No SQL injection vectors (all queries use Supabase parameterized builder)
- Zero `@ts-nocheck` / `@ts-ignore` in src/
- All package.json dependencies are actively used

---

## 3. DATABASE & SUPABASE

| Metric | Value |
|--------|-------|
| Migrations | 90 (after B-series archival) |
| Edge Functions | 18 deployed, all ACTIVE |
| RLS | Enabled on all ~31 tables |
| Indexes | ~55+ composite/covering indexes |
| Cron jobs | 1 (`at-sync-auto-dispatch`, every 15min) |
| Storage buckets | 3 (invoices, partner-logos, upload-queue) |

### Database Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| **DB-1** | HIGH | **Cron function URL**: Old migrations had `oqvvtcfvjkghrwaatprx` (wrong project). **VERIFIED FIXED** — live function uses `dmprkdvkzzjtixlatnlx` (correct). Cron returns `skipped: outside_window` correctly. |
| **DB-2** | MEDIUM | **`profiles` RLS gap**: SELECT policy still uses legacy `accountant_id` column instead of `client_accountants` join. Accountants linked via many-to-many cannot view client profiles. |
| **DB-3** | MEDIUM | **`invoices` bucket uses `getPublicUrl()`** but bucket is private. Should use `createSignedUrl()`. May cause broken invoice image display. |
| **DB-4** | LOW | `tax_withholdings.client_id` has no FK constraint — orphaned records possible. |
| **DB-5** | LOW | `at_withholding_candidates` has dual columns `confidence` + `confidence_score` from schema drift. |
| **DB-6** | LOW | `reencrypt-credentials` not declared in `supabase/config.toml`. |

---

## 4. AT CONNECTOR STATUS

### Supabase Secrets

| Secret | Configured | Status |
|--------|-----------|--------|
| `AI_API_KEY` | Yes | OK |
| `SITE_URL` | Yes | OK |
| `SUPABASE_URL` | Yes | Auto-injected |
| `SUPABASE_ANON_KEY` | Yes | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | OK |
| `SUPABASE_DB_URL` | Yes | OK |
| `AT_CONNECTOR_URL` | **NO** | **BLOCKER** — Must be set to VPS HTTPS URL |
| `AT_CONNECTOR_TOKEN` | **NO** | **BLOCKER** — Must match CONNECTOR_TOKEN on VPS |
| `AT_ENCRYPTION_KEY` | **Verify** | Should match the key used during re-encryption |

### VPS Requirements (for the developer)

The AT Connector (`services/at-connector/`) needs:

**On the VPS:**

| Item | Detail |
|------|--------|
| Runtime | Node.js 20+ |
| Process manager | PM2 or systemd |
| Reverse proxy | Caddy or Nginx (HTTPS termination) |
| Public HTTPS URL | e.g., `https://at-connector.yourdomain.com` |

**Environment Variables (VPS .env):**

| Variable | Required | Description |
|----------|----------|-------------|
| `CONNECTOR_TOKEN` | YES | Must match `AT_CONNECTOR_TOKEN` in Supabase secrets |
| `AT_PUBLIC_CERT_PATH` | YES | Path to `Chave Cifra Publica AT 2027.cer` |
| `AT_KEY_PEM_PATH` | YES (PEM) | Client private key PEM |
| `AT_CERT_PEM_PATH` | YES (PEM) | Client certificate PEM |
| `AT_PFX_PATH` | ALT | PFX file (alternative to PEM pair) |
| `AT_PFX_PASSPHRASE` | ALT | PFX passphrase |
| `PORT` | No (default 8787) | Connector listen port |

**Files needed on disk:**
1. AT public encryption certificate (`Chave Cifra Publica AT 2027.cer`)
2. Client mTLS private key + certificate (PEM exported from PFX)

### Connection Flow

```
pg_cron (*/15 min) → run_scheduled_at_sync()
  └→ at_sync_jobs INSERT
  └→ HTTP POST → process-at-sync-queue
       └→ Bearer service_role → sync-efatura
            └→ Decrypt AT credentials (AT_ENCRYPTION_KEY)
            └→ POST {AT_CONNECTOR_URL}/v1/invoices (Bearer AT_CONNECTOR_TOKEN)
                 └→ AT SOAP API via mTLS (Node/OpenSSL on VPS)
```

### To Activate AT Sync

1. Start the connector on VPS: `cd services/at-connector && npm install && npm start`
2. Verify health: `curl https://your-vps-url/health`
3. Generate a strong token: `openssl rand -hex 32`
4. Set secrets in Supabase:
   ```bash
   supabase secrets set AT_CONNECTOR_URL=https://your-vps-url AT_CONNECTOR_TOKEN=<generated-token> --project-ref dmprkdvkzzjtixlatnlx
   ```
5. Set same token on VPS: `CONNECTOR_TOKEN=<generated-token>`
6. Test: trigger sync for 1 client from the UI or via `run_scheduled_at_sync(true)`

---

## 5. PASSWORDS & ACCESS

| Item | Status |
|------|--------|
| Temp password `IVAzen-Temp-2026!` | **INVALIDATED** — 405/405 users reset |
| Super admin (bilal.machraa@gmail.com) | Excluded from reset, password unchanged |
| Verification test | Old password returns `invalid_credentials` |
| B3_insert_users.sql | Moved to `ops/migrations-archive/` (still in git history) |

> **Note**: The B3 file content remains in git history. For full cleanup, run `bfg-repo-cleaner` or `git filter-repo` to purge it. This is optional since passwords are already invalidated.

---

## 6. UNTRACKED FILES (not yet in repo)

| Path | Contents | Recommendation |
|------|----------|----------------|
| `.github/workflows/ci.yml` | GitHub Actions CI (lint + test + build) | Push when GitHub token has `workflow` scope |
| `.storybook/` | Storybook config | Push if design system docs are wanted |
| `src/stories/` | Component stories | Push with Storybook |
| `.env` | Local credentials | NEVER commit |
| `.claude/` | Claude Code config | Optional |

---

## 7. ACTION ITEMS (Priority Order)

### Immediate (Security)

| # | Item | Effort |
|---|------|--------|
| 1 | **Fix IDOR in classify-invoice + classify-sales-category** — add ownership check | 30 min |
| 2 | **Restrict CORS** — standardize all edge functions to use `APP_ORIGIN` pattern | 1h |
| 3 | **Add role check to check-fiscal-deadlines** — admin/service_role only | 15 min |

### Before AT Sync Go-Live

| # | Item | Effort | Owner |
|---|------|--------|-------|
| 4 | Set `AT_CONNECTOR_URL` + `AT_CONNECTOR_TOKEN` in Supabase secrets | 5 min | Dev (VPS ready) |
| 5 | Verify `AT_ENCRYPTION_KEY` matches re-encryption key | 5 min | Dev |
| 6 | Test 1 client sync end-to-end | 15 min | Dev |

### Short Term (Code Quality)

| # | Item | Effort |
|---|------|--------|
| 7 | Fix `getPublicUrl()` → `createSignedUrl()` in useInvoices.tsx:409 | 10 min |
| 8 | Fix `profiles` RLS policy to use `client_accountants` | 20 min |
| 9 | Remove 18 console.logs + 3 credential/NIF log lines in edge functions | 30 min |
| 10 | Standardize Supabase JS version across all edge functions | 30 min |

### Medium Term

| # | Item | Effort |
|---|------|--------|
| 11 | Configure `VITE_SENTRY_DSN` on Vercel for error monitoring | 5 min |
| 12 | Push `.github/workflows/ci.yml` (needs `workflow` token scope) | 10 min |
| 13 | Add FK on `tax_withholdings.client_id` | 10 min |
| 14 | Send recovery emails to 405 users (when ready to activate) | 5 min (script ready) |
| 15 | Upgrade `xlsx` to maintained version or switch to `exceljs` | 2h |

---

*Report generated: 2026-03-02 22:05 UTC*
*Commit: b1c4ce6 (main)*
*Repo: https://github.com/bilalmachraa82/ivazen-saas*
