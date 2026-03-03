# IVAzen AT Sync - Audit Report (2026-03-03)

## 1. Executive Summary

This report documents the complete AT (Autoridade Tributaria) e-Fatura synchronization system for IVAzen SaaS. It covers architecture, security, scheduling, current status, and changes made on 2026-03-03.

### Key Changes (2026-03-03)
- **REMOVED**: Portal scraping fallback (illegal) from `sync-efatura`, `process-at-sync-queue`
- **DISABLED**: `fetch-efatura-portal` edge function (returns 410 Gone)
- **FIXED**: Added diagnostic logging for intermittent credential decryption failures
- **CONFIGURED**: `AT_ALLOW_ACCOUNTANT_FALLBACK=1` secret
- **DEPLOYED**: 3 edge functions redeployed (`sync-efatura`, `fetch-efatura-portal`, `process-at-sync-queue`)

---

## 2. Architecture Overview

### Data Flow
```
pg_cron (every 15 min)
  |
  v
run_scheduled_at_sync() [PostgreSQL function]
  |  - Checks time window (06:00-06:15 or 19:30-19:45 Lisbon time)
  |  - Creates batch jobs in at_sync_jobs table
  |  - Triggers processor via pg_net HTTP POST
  v
process-at-sync-queue [Supabase Edge Function]
  |  - Processes 5 clients per batch
  |  - Self-triggers for remaining jobs
  v
sync-efatura [Supabase Edge Function]
  |  - Decrypts AT credentials (AES-256-GCM)
  |  - Calls external VPS connector
  v
AT Connector [Node.js on VPS]
  |  - mTLS client certificate auth
  |  - SOAP/WS-Security envelope
  |  - AES-128-ECB credential encryption (AT proprietary)
  v
AT SOAP Webservice [servicos.portaldasfinancas.gov.pt]
  |  - Port 425 (production) / 725 (test)
  |  - Returns invoice XML
  v
[Response flows back through chain]
  |  - XML parsed to JSON in connector
  |  - Invoices stored in purchase_invoices / sales_invoices tables
  |  - Sync history recorded in at_sync_history
```

### Components

| Component | Location | Runtime | Purpose |
|-----------|----------|---------|---------|
| AT Connector | `services/at-connector/` | Node.js on VPS | mTLS proxy to AT SOAP API |
| sync-efatura | `supabase/functions/sync-efatura/` | Deno (Edge) | Orchestrates sync per client |
| process-at-sync-queue | `supabase/functions/process-at-sync-queue/` | Deno (Edge) | Batch processor (5 clients/invocation) |
| sync-queue-manager | `supabase/functions/sync-queue-manager/` | Deno (Edge) | Manual bulk sync trigger (accountant UI) |
| fetch-efatura-portal | `supabase/functions/fetch-efatura-portal/` | Deno (Edge) | **DISABLED** - Returns 410 Gone |
| run_scheduled_at_sync() | PostgreSQL function | pg_cron | Scheduler/dispatcher |

---

## 3. AT API Time Restriction

### External Constraint
The AT SOAP webservice is **only available between 19:00 and 07:00 Lisbon time** (Europe/Lisbon timezone). Outside this window, the API returns:
```
"Fora do periodo valido de invocacao (19h-07h)"
```

### Scheduler Windows
The automated sync is configured to run within the AT availability window:

| Window | Lisbon Time | Slot Name | Purpose |
|--------|-------------|-----------|---------|
| Evening | 19:30 - 19:45 | `evening` | Primary sync window (shortly after AT opens) |
| Morning | 06:00 - 06:15 | `morning` | Secondary sync window (before AT closes) |

### How It Works
1. **pg_cron** fires `run_scheduled_at_sync(false)` every 15 minutes (`*/15 * * * *`)
2. The function checks current Lisbon time against the two windows
3. Outside windows: returns `{"skipped": "outside_window"}` immediately
4. Inside window: creates batch jobs and triggers processor
5. **Idempotency**: Unique constraint prevents duplicate runs per day/slot

### Manual Override
- `run_scheduled_at_sync(true)` bypasses time window checks
- Creates jobs with `slot = 'manual'`
- Still subject to AT's own 19:00-07:00 restriction (will get errors outside window)

---

## 4. Scheduling Configuration

### pg_cron Job
```sql
-- Job: at-sync-auto-dispatch
-- Schedule: Every 15 minutes
-- Function: public.run_scheduled_at_sync(false)
PERFORM cron.schedule(
  'at-sync-auto-dispatch',
  '*/15 * * * *',
  'select public.run_scheduled_at_sync(false);'
);
```

### Eligible Client Criteria
A client is queued for sync when ALL conditions are met:
1. Has `at_credentials` row with `portal_nif` and `encrypted_password`
2. Environment = `production`
3. No pending/processing jobs for the same fiscal year
4. No `AT_YEAR_UNAVAILABLE` reason code in last 30 days
5. **Current year**: Last sync > 6 hours ago OR status is `error`/`partial`
6. **Previous year**: No prior successful API sync exists for that year

### Fiscal Years Queued
- **Scheduled (automatic)**: Current year + Previous year only
- **Manual (force=true)**: Current year + Previous year only (same policy since migration 20260224184000)

---

## 5. Database Schema

### Key Tables

#### `at_credentials` (138 rows)
| Column | Type | Purpose |
|--------|------|---------|
| client_id | UUID (unique) | Client reference |
| accountant_id | UUID | Associated accountant |
| encrypted_username | TEXT | NIF (plain text) or encrypted WFA username |
| encrypted_password | TEXT | AES-256-GCM encrypted (`salt:iv:ciphertext`) |
| subuser_id | TEXT | WFA format (NIF/subuser number) |
| portal_nif | TEXT | Client NIF for portal access |
| portal_password_encrypted | TEXT | AES-256-GCM encrypted portal password |
| environment | TEXT | `test` or `production` |
| last_sync_at | TIMESTAMPTZ | Last sync timestamp |
| last_sync_status | TEXT | `success`, `partial`, `error`, `never` |
| last_sync_error | TEXT | Last error message |

#### `at_sync_history` (audit trail)
| Column | Type | Purpose |
|--------|------|---------|
| client_id | UUID | Client reference |
| sync_type | TEXT | `compras`, `vendas`, `ambos` |
| sync_method | TEXT | `api`, `csv`, `manual`, `portal` (legacy) |
| status | TEXT | `pending`, `running`, `success`, `partial`, `error` |
| reason_code | TEXT | `AT_EMPTY_LIST`, `AT_AUTH_FAILED`, etc. |
| records_imported/skipped/errors | INT | Counters |
| metadata | JSONB | Full context (environment, NIF, credential source, etc.) |

#### `at_sync_jobs` (batch processing)
| Column | Type | Purpose |
|--------|------|---------|
| accountant_id / client_id | UUID | Target |
| fiscal_year | INT | Year to sync |
| status | TEXT | `pending`, `processing`, `completed`, `error` |
| job_batch_id | UUID | Groups jobs from same dispatch |
| invoices_synced | INT | Result count |

#### `at_sync_automation_runs` (scheduler runs)
| Column | Type | Purpose |
|--------|------|---------|
| run_date | DATE | Local PT date |
| run_slot | TEXT | `morning`, `evening`, `manual` |
| total_jobs | INT | Jobs enqueued |
| batches | JSONB | `[{fiscal_year, batch_id, jobs}]` |

#### `accountant_at_config` (shared accountant credentials)
| Column | Type | Purpose |
|--------|------|---------|
| accountant_id | UUID (unique) | Accountant reference |
| subuser_id | TEXT | WFA username |
| subuser_password_encrypted | TEXT | AES-256-GCM encrypted |
| is_active | BOOLEAN | Whether config is active |

---

## 6. Security

### Credential Encryption
- **Algorithm**: AES-256-GCM with PBKDF2 key derivation (100,000 iterations, SHA-256)
- **Format**: `<salt_base64>:<iv_base64>:<ciphertext_base64>` (colon-separated)
- **Key source**: `AT_ENCRYPTION_KEY` env var (falls back to service role key prefix if unavailable)
- **Storage**: All passwords stored encrypted; usernames may be plain NIF (9 digits)

### AT Connector Authentication
- **Bearer token**: Timing-safe comparison (`crypto.timingSafeEqual`)
- **mTLS**: Client certificate (PEM preferred over PFX)
- **WS-Security**: RSA-encrypted AES-128-ECB session key (AT proprietary scheme)

### Edge Function Auth
- `sync-efatura`: `verify_jwt = false`, manual JWT validation (user or service role)
- `process-at-sync-queue`: `verify_jwt = false`, accepts service role token or internal webhook token
- `sync-queue-manager`: `verify_jwt = false`, requires authenticated user with `accountant` role
- `fetch-efatura-portal`: `verify_jwt = true` (disabled, returns 410 Gone)

### IDOR Protection
- `sync-efatura` verifies the authenticated user owns the `clientId` or is an associated accountant
- RLS policies on all credential tables

### Internal Webhook Auth
- `internal_webhook_keys` table stores 256-bit random tokens
- Used by `pg_net.http_post()` to call `process-at-sync-queue` from the database scheduler
- Token passed as `x-internal-webhook-token` header

---

## 7. Current Status

### Environment Variables (Supabase Secrets)
| Secret | Status |
|--------|--------|
| AT_CONNECTOR_URL | OK |
| AT_CONNECTOR_TOKEN | OK |
| AT_ENCRYPTION_KEY | OK |
| APP_ORIGIN | OK |
| AT_ALLOW_ACCOUNTANT_FALLBACK | OK (set 2026-03-03) |
| AT_CONNECTOR_CA_CERT | Not configured |
| AT_CONNECTOR_CA_CERT_B64 | Not configured |

### Recent Automation Runs
| Date | Slot | Time (Lisbon) | Jobs |
|------|------|---------------|------|
| 2026-03-03 | morning | 06:00 | 136 |
| 2026-03-02 | manual | 22:42 | 145 |
| 2026-03-02 | evening | 19:30 | 145 |
| 2026-03-02 | morning | 06:00 | 145 |
| 2026-03-01 | evening | 19:30 | 143 |
| 2026-03-01 | morning | 06:00 | 0 |

### Sync History (Last 24h as of 2026-03-03 16:00 UTC)
| Metric | Value |
|--------|-------|
| Total syncs | 636 |
| Via API (connector) | 346 |
| Via Portal (legacy, pre-connector) | 290 |
| Successful | 189 |
| Errors | 426 |
| Partial | 18 |

### Error Breakdown (API syncs)
| Reason Code | Count | Description |
|-------------|-------|-------------|
| AT_EMPTY_LIST | 191 | No invoices in requested period (normal) |
| AT_AUTH_FAILED | 139 | Credential decryption or AT auth failure |
| UNKNOWN_AT_ERROR | 145 | Unclassified AT errors |
| AT_SCHEMA_RESPONSE_ERROR | 13 | Malformed AT response |

---

## 8. Known Issues

### 8.1 Intermittent Credential Decryption Failure (HIGH)
**Symptom**: Same client succeeds at 22:49 and fails at 06:01 with "Sem credenciais utilizaveis"
**Root Cause**: Suspected Supabase edge function cold start where `Deno.env.get("AT_ENCRYPTION_KEY")` returns `undefined`. The fallback uses the service role key prefix, which cannot decrypt credentials encrypted with the actual `AT_ENCRYPTION_KEY`.
**Impact**: All 138 credentials show `last_sync_status=error` from the 06:01 morning batch
**Mitigation Applied**: Added detailed logging (2026-03-03):
- Logs when `AT_ENCRYPTION_KEY` is not available
- Logs which credential fields exist vs. null after decryption
- Logs payload length and key presence on decryption errors
**Recommended Fix**: Monitor next scheduled run (19:30 today). If decryption failures persist, consider:
1. Pre-warming the edge function before batch processing
2. Adding a retry mechanism with exponential backoff
3. Storing a redundant copy of the encryption key in the database (encrypted)

### 8.2 Portal Scraping Removed (RESOLVED)
**Previous State**: `sync-efatura` fell back to `fetch-efatura-portal` when connector was not configured or failed
**Resolution**: Portal scraping code removed. Function returns 410 Gone. All references cleaned from `process-at-sync-queue`.

### 8.3 Withholding Auto-Sync Disabled (LOW)
**Previous State**: `process-at-sync-queue` called `fetch-efatura-portal` for automatic withholding (Modelo 10) candidate detection
**Current State**: Removed since it depended on portal scraping
**Impact**: Withholdings must be uploaded manually or via CSV until a SOAP-based alternative is implemented

### 8.4 CA Certificate Not Configured (LOW)
**Issue**: `AT_CONNECTOR_CA_CERT` and `AT_CONNECTOR_CA_CERT_B64` are not set
**Impact**: Only relevant if the VPS uses a private CA for TLS (e.g., Caddy `tls internal`). If using a public CA (e.g., Let's Encrypt), this is not needed.

---

## 9. Edge Functions Deployed

| Function | Version/Date | Status | verify_jwt |
|----------|-------------|--------|------------|
| sync-efatura | 2026-03-03 | Active | false (manual auth) |
| process-at-sync-queue | 2026-03-03 | Active | false (manual auth) |
| sync-queue-manager | Pre-existing | Active | false (manual auth) |
| fetch-efatura-portal | 2026-03-03 | **DISABLED (410)** | true |

---

## 10. AT Connector (VPS Service)

### Configuration
| Setting | Value |
|---------|-------|
| Runtime | Node.js |
| Port | 8787 (default) |
| Auth | Bearer token (timing-safe) |
| TLS | mTLS with AT client certificate |
| Encryption | AES-128-ECB (AT WS-Security) |
| Pagination | Monthly date splits, max 5000 docs/page |

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` or `/healthz` | Health check with config status |
| POST | `/v1/invoices` | Query invoices from AT |

### Request Format
```json
{
  "environment": "production",
  "clientNif": "999999999",
  "username": "999999999/1",
  "password": "plain-text-password",
  "type": "ambos",
  "startDate": "2026-01-01",
  "endDate": "2026-03-03"
}
```

### AT SOAP Endpoints
| Environment | URL |
|-------------|-----|
| Test | `https://servicos.portaldasfinancas.gov.pt:725/fatshare/ws/fatshareFaturas` |
| Production | `https://servicos.portaldasfinancas.gov.pt:425/fatshare/ws/fatshareFaturas` |

---

## 11. Test Coverage

| Area | Tests | Files |
|------|-------|-------|
| Unit tests (Vitest) | 644 | 24 |
| Build | Passes | - |
| E2E (Playwright) | Configured | `e2e/` |

All 644 unit tests pass as of 2026-03-03 16:55 UTC.

---

## 12. Files Modified (2026-03-03)

| File | Change |
|------|--------|
| `supabase/functions/sync-efatura/index.ts` | Removed portal fallback, added connector-required check, improved decryption logging |
| `supabase/functions/fetch-efatura-portal/index.ts` | Replaced with 410 Gone stub |
| `supabase/functions/process-at-sync-queue/index.ts` | Removed withholding auto-sync via portal |
| `supabase/config.toml` | Changed `fetch-efatura-portal` verify_jwt to true |
| `src/pages/EFaturaSync.tsx` | Updated sync method display labels |

---

## 13. Recommendations

### Immediate (before next scheduled run at 19:30)
1. **Monitor 19:30 run**: Check Supabase edge function logs for `AT_ENCRYPTION_KEY present: false` messages
2. **Verify connector health**: Call VPS `/health` endpoint to confirm it's online
3. **Check AT availability**: Confirm AT API responds after 19:00

### Short-term
4. **Implement withholding sync via SOAP**: Replace removed portal-based withholding detection with official AT webservice
5. **Add connector health monitoring**: Periodic check from Supabase to VPS `/health`
6. **Pre-warm edge functions**: Trigger a dummy call to `sync-efatura` before batch processing to ensure env vars are loaded

### Medium-term
7. **Add retry logic**: For transient AT failures (network timeouts, temporary unavailability)
8. **Dashboard for sync status**: Frontend UI showing scheduler status, last run, success rate
9. **Alerting**: Notify admin when error rate exceeds threshold

---

*Report generated: 2026-03-03 16:55 UTC*
*Build: 644 tests passing, clean build*
*Edge functions: 3 redeployed*
