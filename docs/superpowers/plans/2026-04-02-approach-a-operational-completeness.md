# Approach A — Operational Completeness Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all operational gaps: supplier name enrichment via VIES, nightly AI classification backfill, recibos verdes automation via Playwright, Sentry user context, and AT XML parser fix.

**Architecture:** Five independent workstreams. VIES enrichment adds a new edge function `enrich-supplier-vies` called nightly via pg_cron. Classification backfill runs as a VPS cron script (avoids Supabase worker limits). Playwright replaces the HTTP portal scraper in the AT connector Docker image. Sentry.setUser() hooks into the existing AuthProvider. XML fix adds date-range chunking to retry partial clients.

**Tech Stack:** Supabase Edge Functions (Deno), Node.js (VPS), Playwright, VIES REST API, Google AI Studio free tier, Sentry SDK, pg_cron.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/functions/enrich-supplier-vies/index.ts` | Edge function: batch VIES lookup for supplier_directory |
| `supabase/migrations/2026XXXX_add_vies_enrichment_cron.sql` | pg_cron job for nightly VIES + classification |
| `services/at-connector/src/playwrightScraper.js` | Browser-based portal scraper using Playwright |
| `services/at-connector/Dockerfile.playwright` | Extended Docker image with Chromium |

### Modified Files
| File | Change |
|------|--------|
| `src/hooks/useAuth.tsx` | Add Sentry.setUser() on auth state change |
| `services/at-connector/src/index.js` | Route /v1/recibos-verdes to Playwright scraper, add retry-with-smaller-range for partial clients |
| `services/at-connector/package.json` | Add playwright dependency |
| `supabase/functions/sync-efatura/index.ts` | Add month-by-month retry for AT_SCHEMA_RESPONSE_ERROR clients |

### Test Files
| File | What it tests |
|------|--------------|
| `src/lib/__tests__/viesLookup.test.ts` | VIES response parsing, NIF validation |
| `supabase/functions/enrich-supplier-vies/vies.test.ts` | Edge function logic unit tests |

---

## Task 1: Sentry.setUser() for user correlation

**Files:**
- Modify: `src/hooks/useAuth.tsx:42-73`

- [ ] **Step 1: Write the test expectation**

In `src/hooks/useAuth.tsx`, after the auth state is set, Sentry should receive user context. No separate test file needed — this is a side-effect integration. Verify manually in Sentry dashboard after deploy.

- [ ] **Step 2: Add Sentry.setUser() to auth state handler**

In `src/hooks/useAuth.tsx`, find the `onAuthStateChange` handler. After the user and roles are set, add:

```typescript
// At the top of the file, add import:
import * as Sentry from "@sentry/react";

// Inside the onAuthStateChange callback, after setUser(session.user) and roles are fetched:
if (session?.user) {
  Sentry.setUser({
    id: session.user.id,
    email: session.user.email,
  });
} else {
  Sentry.setUser(null);
}
```

Place this AFTER line ~51 (where `setUser(session.user)` is called) and inside the same block. On sign-out (`!session`), clear Sentry user.

- [ ] **Step 3: Also set user on initial session restore**

In the `getSession()` block (~line 61-70), add the same Sentry.setUser() call after the initial session is restored.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: SUCCESS (Sentry is already a dependency)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.tsx
git commit -m "feat: set Sentry user context on auth state changes"
```

---

## Task 2: VIES supplier name enrichment

### Task 2a: VIES lookup utility and tests

**Files:**
- Create: `supabase/functions/_shared/viesLookup.ts`
- Create: `src/lib/__tests__/viesLookup.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/viesLookup.test.ts
import { describe, expect, it } from 'vitest';
import { isBusinessNif, parseViesResponse } from './viesHelpers';

// We test the pure parsing logic, not the fetch (no network in unit tests)
describe('VIES helpers', () => {
  it('identifies business NIFs (5xx prefix)', () => {
    expect(isBusinessNif('509442013')).toBe(true);
    expect(isBusinessNif('123456789')).toBe(false);
    expect(isBusinessNif('600000001')).toBe(true);
    expect(isBusinessNif('999999990')).toBe(false);
  });

  it('parses a valid VIES response', () => {
    const result = parseViesResponse({
      isValid: true,
      name: 'NEXPERIENCE, UNIPESSOAL, LDA',
      address: 'RUA DE SANTA CATARINA N 1232\nPORTO, 4000-457 PORTO',
    });
    expect(result).toEqual({
      name: 'NEXPERIENCE, UNIPESSOAL, LDA',
      city: 'PORTO',
      valid: true,
    });
  });

  it('returns null name for invalid NIF', () => {
    const result = parseViesResponse({ isValid: false, name: '---', address: '' });
    expect(result).toEqual({ name: null, city: null, valid: false });
  });

  it('extracts city from last line of address', () => {
    const result = parseViesResponse({
      isValid: true,
      name: 'TEST LDA',
      address: 'RUA X\n1000-001 LISBOA',
    });
    expect(result.city).toBe('LISBOA');
  });
});
```

- [ ] **Step 2: Create the helper module**

```typescript
// src/lib/viesHelpers.ts
export function isBusinessNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  const prefix = nif[0];
  // Business NIFs: 5xx (companies), 6xx (public entities), 7xx (foreign)
  // Exclude 999999990 (final consumer)
  return ['5', '6', '7'].includes(prefix) && nif !== '999999990';
}

interface ViesApiResponse {
  isValid: boolean;
  name: string;
  address: string;
}

interface ViesResult {
  name: string | null;
  city: string | null;
  valid: boolean;
}

export function parseViesResponse(data: ViesApiResponse): ViesResult {
  if (!data.isValid || data.name === '---' || !data.name) {
    return { name: null, city: null, valid: false };
  }

  let city: string | null = null;
  if (data.address) {
    const lines = data.address.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      // Portuguese postal code format: NNNN-NNN CITY
      const match = lastLine.match(/\d{4}-\d{3}\s+(.+)/);
      city = match ? match[1].trim() : null;
    }
  }

  return { name: data.name, city, valid: true };
}
```

- [ ] **Step 3: Fix test import path and run**

Update test imports to point to `../../lib/viesHelpers` (adjust vitest alias).

Run: `npx vitest src/lib/__tests__/viesLookup.test.ts`
Expected: 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/viesHelpers.ts src/lib/__tests__/viesLookup.test.ts
git commit -m "feat: add VIES response parser with tests"
```

### Task 2b: VIES enrichment edge function

**Files:**
- Create: `supabase/functions/enrich-supplier-vies/index.ts`

- [ ] **Step 1: Create the edge function**

```typescript
// supabase/functions/enrich-supplier-vies/index.ts
import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { extractBearerToken, isServiceRoleToken } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://ivazen-saas.vercel.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const VIES_API = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms/PT/vat";
const BATCH_SIZE = 50;        // NIFs per run
const DELAY_MS = 1000;        // 1s between VIES calls (avoid rate limit)
const BUSINESS_PREFIXES = ["5", "6", "7"];

function isBusinessNif(nif: string): boolean {
  return /^\d{9}$/.test(nif) && BUSINESS_PREFIXES.includes(nif[0]) && nif !== "999999990";
}

function parseCityFromAddress(address: string): string | null {
  if (!address) return null;
  const lines = address.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const match = lines[lines.length - 1].match(/\d{4}-\d{3}\s+(.+)/);
  return match ? match[1].trim() : null;
}

async function lookupVies(nif: string): Promise<{ name: string; city: string | null } | null> {
  try {
    const res = await fetch(`${VIES_API}/${nif}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.isValid || !data.name || data.name === "---") return null;
    return { name: data.name, city: parseCityFromAddress(data.address || "") };
  } catch {
    return null;
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const token = extractBearerToken(req.headers.get("Authorization"));
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!token || !isServiceRoleToken(token, serviceKey)) {
    return new Response(JSON.stringify({ error: "Service role required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
  );

  // Find business NIFs in supplier_directory with source != 'vies' and source != 'nif_pt' and source != 'manual'
  // OR NIFs in invoices table that are NOT in supplier_directory at all
  const { data: missingNifs, error: queryError } = await supabase.rpc("get_unenriched_business_nifs", {
    batch_limit: BATCH_SIZE,
  });

  if (queryError) {
    return new Response(JSON.stringify({ error: queryError.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!missingNifs || missingNifs.length === 0) {
    return new Response(JSON.stringify({ success: true, enriched: 0, message: "No NIFs to enrich" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let enriched = 0;
  let failed = 0;

  for (const row of missingNifs) {
    const nif = row.nif;
    if (!isBusinessNif(nif)) { failed++; continue; }

    const result = await lookupVies(nif);
    if (result) {
      await supabase.from("supplier_directory").upsert({
        nif,
        name: result.name,
        city: result.city,
        source: "vies",
        confidence: 90,
        updated_at: new Date().toISOString(),
      }, { onConflict: "nif" });

      // Propagate to invoices and sales_invoices
      await supabase.from("invoices")
        .update({ supplier_name: result.name })
        .eq("supplier_nif", nif)
        .or("supplier_name.is.null,supplier_name.eq.");

      await supabase.from("sales_invoices")
        .update({ supplier_name: result.name })
        .eq("supplier_nif", nif)
        .or("supplier_name.is.null,supplier_name.eq.");

      enriched++;
    } else {
      // Mark as attempted so we don't retry every night
      await supabase.from("supplier_directory").upsert({
        nif,
        name: nif,  // Placeholder — still unresolved
        source: "vies_failed",
        confidence: 10,
        updated_at: new Date().toISOString(),
      }, { onConflict: "nif", ignoreDuplicates: true });
      failed++;
    }

    await sleep(DELAY_MS);
  }

  return new Response(JSON.stringify({ success: true, enriched, failed, total: missingNifs.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Create the database RPC function**

Create migration `supabase/migrations/20260402010000_add_vies_enrichment.sql`:

```sql
-- RPC to find business NIFs not yet enriched via VIES or nif.pt
CREATE OR REPLACE FUNCTION get_unenriched_business_nifs(batch_limit int DEFAULT 50)
RETURNS TABLE(nif text) LANGUAGE sql STABLE AS $$
  -- Business NIFs from invoices that are NOT in supplier_directory
  -- or are in supplier_directory with low-quality source
  SELECT DISTINCT i.supplier_nif AS nif
  FROM invoices i
  WHERE i.supplier_nif ~ '^\d{9}$'
    AND i.supplier_nif != '999999990'
    AND LEFT(i.supplier_nif, 1) IN ('5', '6', '7')
    AND (
      NOT EXISTS (
        SELECT 1 FROM supplier_directory sd
        WHERE sd.nif = i.supplier_nif
          AND sd.source IN ('vies', 'nif_pt', 'manual')
      )
    )
  UNION
  SELECT DISTINCT si.supplier_nif AS nif
  FROM sales_invoices si
  WHERE si.supplier_nif ~ '^\d{9}$'
    AND si.supplier_nif != '999999990'
    AND LEFT(si.supplier_nif, 1) IN ('5', '6', '7')
    AND (
      NOT EXISTS (
        SELECT 1 FROM supplier_directory sd
        WHERE sd.nif = si.supplier_nif
          AND sd.source IN ('vies', 'nif_pt', 'manual')
      )
    )
  LIMIT batch_limit;
$$;

-- Nightly VIES enrichment cron (02:30 UTC = 03:30 Lisbon)
SELECT cron.schedule(
  'nightly-vies-enrichment',
  '30 2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/enrich-supplier-vies',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 3: Deploy and test locally**

```bash
supabase functions deploy enrich-supplier-vies
supabase db push  # Apply migration
```

Test manually:
```bash
curl -s https://dmprkdvkzzjtixlatnlx.supabase.co/functions/v1/enrich-supplier-vies \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `{"success":true,"enriched":N,"failed":M,"total":50}`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/enrich-supplier-vies/ supabase/migrations/20260402010000_add_vies_enrichment.sql
git commit -m "feat: add nightly VIES supplier name enrichment"
```

---

## Task 3: Nightly AI classification backfill

### Task 3a: Classification cron edge function

**Files:**
- Create: `supabase/functions/nightly-classify/index.ts`
- Modify: migration from Task 2b to add the cron job

- [ ] **Step 1: Create the nightly classification orchestrator**

This function runs nightly. It first applies rules (free), then uses AI for the rest (up to daily budget).

```typescript
// supabase/functions/nightly-classify/index.ts
import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { extractBearerToken, isServiceRoleToken } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://ivazen-saas.vercel.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const RULES_BATCH = 200;    // Invoices to try rules-only per call
const AI_BATCH = 30;         // Invoices to send to AI per call (edge function timeout ~150s)
const AI_DELAY_MS = 500;     // Delay between AI calls

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const token = extractBearerToken(req.headers.get("Authorization"));
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!token || !isServiceRoleToken(token, serviceKey)) {
    return new Response(JSON.stringify({ error: "Service role required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Phase 1: Rules-only pass (free, fast)
  // Find unclassified invoices that have a matching rule
  const { data: rulesEligible } = await supabase
    .from("invoices")
    .select("id, supplier_nif, client_id")
    .is("classification_result", null)
    .not("supplier_nif", "is", null)
    .limit(RULES_BATCH);

  let rulesApplied = 0;

  if (rulesEligible?.length) {
    for (const inv of rulesEligible) {
      // Check if a classification_rule exists for this supplier+client
      const { data: rule } = await supabase
        .from("classification_rules")
        .select("classification_result, dp_field, confidence")
        .or(`client_id.eq.${inv.client_id},client_id.is.null`)
        .eq("supplier_nif", inv.supplier_nif)
        .gte("confidence", 70)
        .order("confidence", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rule) {
        await supabase.from("invoices").update({
          classification_result: rule.classification_result,
          dp_field: rule.dp_field,
          classification_confidence: rule.confidence,
          classification_source: "rule",
          status: rule.confidence >= 85 ? "validated" : "pending",
        }).eq("id", inv.id);
        rulesApplied++;
      }
    }
  }

  // Phase 2: AI classification for remaining (budget-limited)
  // Call classify-invoice edge function for each (unique NIF first)
  const { data: aiEligible } = await supabase
    .from("invoices")
    .select("id, client_id, supplier_nif")
    .is("classification_result", null)
    .not("supplier_nif", "is", null)
    .limit(AI_BATCH);

  let aiClassified = 0;
  let aiErrors = 0;

  if (aiEligible?.length) {
    for (const inv of aiEligible) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/classify-invoice`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ invoice_id: inv.id }),
          signal: AbortSignal.timeout(30_000),
        });
        if (res.ok) {
          aiClassified++;
        } else {
          aiErrors++;
        }
      } catch {
        aiErrors++;
      }
      await new Promise(r => setTimeout(r, AI_DELAY_MS));
    }
  }

  // Phase 3: Sales revenue_category (same pattern)
  const { data: salesEligible } = await supabase
    .from("sales_invoices")
    .select("id")
    .is("revenue_category", null)
    .limit(AI_BATCH);

  let salesClassified = 0;

  if (salesEligible?.length) {
    for (const inv of salesEligible) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/classify-sales-category`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ invoice_id: inv.id }),
          signal: AbortSignal.timeout(30_000),
        });
        if (res.ok) salesClassified++;
      } catch { /* continue */ }
      await new Promise(r => setTimeout(r, AI_DELAY_MS));
    }
  }

  return new Response(JSON.stringify({
    success: true,
    rulesApplied,
    aiClassified,
    aiErrors,
    salesClassified,
    remainingPurchases: (rulesEligible?.length || 0) - rulesApplied,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Add cron job to the migration**

Append to `supabase/migrations/20260402010000_add_vies_enrichment.sql`:

```sql
-- Nightly classification backfill (03:00 UTC = 04:00 Lisbon)
-- Runs every 15 min from 03:00-05:45 UTC to process batches within edge function timeout
SELECT cron.schedule(
  'nightly-classify-backfill',
  '*/15 3-5 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/nightly-classify',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

This runs 12 times per night (every 15 min from 03:00-05:45), processing ~30 AI + 200 rules per call = ~360 AI + 2400 rules per night. At this rate:
- 166K purchases with ~94% rules match: ~156K rules / 2400 per night = ~65 nights for rules
- ~10K AI calls / 360 per night = ~28 nights for AI
- Total: completes in ~2 months automatically, zero cost

- [ ] **Step 3: Deploy and test**

```bash
supabase functions deploy nightly-classify
```

Test manually:
```bash
curl -s https://dmprkdvkzzjtixlatnlx.supabase.co/functions/v1/nightly-classify \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -d '{}'
```

Expected: `{"success":true,"rulesApplied":N,"aiClassified":M,...}`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/nightly-classify/ supabase/migrations/20260402010000_add_vies_enrichment.sql
git commit -m "feat: add nightly AI classification backfill with rules-first strategy"
```

---

## Task 4: Fix 8 partial XML clients

**Files:**
- Modify: `supabase/functions/sync-efatura/index.ts`

The 8 "partial" clients fail because AT's SOAP server returns a schema error when serializing certain invoices. Our parser handles flexible ordering, but AT's server errors before we even get the data.

**Strategy:** Retry with smaller date ranges (monthly instead of yearly). If a specific month errors, skip it and continue with the rest. This is how Primavera handles AT schema inconsistencies.

- [ ] **Step 1: Add month-by-month retry for schema errors**

In `supabase/functions/sync-efatura/index.ts`, find where `AT_SCHEMA_RESPONSE_ERROR` is detected (around line 220-228). After this error is caught, add retry logic:

```typescript
// After the initial AT connector call fails with schema error:
if (reasonCode === "AT_SCHEMA_RESPONSE_ERROR" && !retryAttempted) {
  console.log("[sync-efatura] Schema error — retrying month-by-month");
  retryAttempted = true;
  
  // Split the date range into individual months and retry each
  const months = splitIntoMonths(startDate, endDate);
  let totalInserted = 0;
  let totalSkipped = 0;
  let monthErrors = 0;
  
  for (const { start, end } of months) {
    try {
      const monthResult = await callATConnector(connectorUrl, connectorToken, {
        ...connectorPayload,
        startDate: start,
        endDate: end,
      });
      if (monthResult.success) {
        // Process this month's invoices
        const processed = await processATResponse(monthResult, clientId, supabase, ...);
        totalInserted += processed.inserted;
        totalSkipped += processed.skipped;
      }
    } catch {
      monthErrors++;
      console.log(`[sync-efatura] Month ${start} failed, skipping`);
    }
  }
  
  // Update status based on partial success
  if (totalInserted > 0 || totalSkipped > 0) {
    reasonCode = null; // Partial success
    // Continue to normal completion path
  }
}
```

- [ ] **Step 2: Add splitIntoMonths helper**

```typescript
function splitIntoMonths(startDate: string, endDate: string): Array<{start: string, end: string}> {
  const months: Array<{start: string, end: string}> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    const monthStart = current.toISOString().split('T')[0];
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0).toISOString().split('T')[0];
    months.push({
      start: monthStart > startDate ? monthStart : startDate,
      end: monthEnd < endDate ? monthEnd : endDate,
    });
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return months;
}
```

- [ ] **Step 3: Test with one of the 8 partial clients**

```bash
curl -s https://dmprkdvkzzjtixlatnlx.supabase.co/functions/v1/sync-efatura \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"bcb1ef59-...","force":true,"source":"manual"}'
```

Expected: status changes from "partial" to "success" with some months processed.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-efatura/index.ts
git commit -m "fix: retry month-by-month for AT schema response errors (8 partial clients)"
```

---

## Task 5: Recibos verdes via Playwright

### Task 5a: Playwright scraper in AT connector

**Files:**
- Create: `services/at-connector/src/playwrightScraper.js`
- Modify: `services/at-connector/package.json`
- Modify: `services/at-connector/src/index.js`

- [ ] **Step 1: Add Playwright dependency**

```bash
cd services/at-connector
npm install playwright-core
```

Note: We use `playwright-core` (no bundled browsers) and install Chromium separately in Docker.

- [ ] **Step 2: Create the Playwright scraper**

```javascript
// services/at-connector/src/playwrightScraper.js
const { chromium } = require('playwright-core');

const BROWSER_TIMEOUT = 60_000;
const NAV_TIMEOUT = 30_000;

async function scrapeRecibosVerdesWithBrowser({ nif, password, startDate, endDate, debug }) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    locale: 'pt-PT',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  try {
    // Step 1: Navigate to login
    const loginUrl = `https://www.acesso.gov.pt/v2/loginForm?partID=PFAP&path=/consultarDocumentosEmitidos.action`;
    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    // Step 2: Fill login form
    await page.selectOption('select[name="selectedAuthMethod"]', 'NIF');
    await page.fill('input[name="username"]', nif);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"], input[type="submit"]');

    // Step 3: Wait for redirect to faturas portal
    await page.waitForURL(/portaldasfinancas/, { timeout: BROWSER_TIMEOUT });

    // Check for login error
    const bodyText = await page.textContent('body');
    if (bodyText.includes('Credenciais inválidas') || bodyText.includes('dados incorretos')) {
      throw new Error('AT_AUTH_FAILED: Invalid portal credentials');
    }

    // Step 4: Navigate to issued documents
    const consultUrl = `https://faturas.portaldasfinancas.gov.pt/consultarDocumentosEmitidos.action`;
    await page.goto(consultUrl, { waitUntil: 'networkidle' });

    // Step 5: Set date filters if provided
    if (startDate) {
      const startFormatted = startDate.split('-').reverse().join('-'); // DD-MM-YYYY
      await page.fill('#dataInicioFilter', startFormatted).catch(() => {});
    }
    if (endDate) {
      const endFormatted = endDate.split('-').reverse().join('-');
      await page.fill('#dataFimFilter', endFormatted).catch(() => {});
    }

    // Step 6: Submit search
    await page.click('button[type="submit"], input.btn-search, #submitFilter').catch(() => {});
    await page.waitForTimeout(3000);

    // Step 7: Extract data via JSON API (preferred)
    const dateParams = [];
    if (startDate) dateParams.push(`dataInicioFilter=${startDate}`);
    if (endDate) dateParams.push(`dataFimFilter=${endDate}`);
    const jsonUrl = `https://faturas.portaldasfinancas.gov.pt/json/obterDocumentosEmitidos.action?${dateParams.join('&')}&ambitoPesquisa=emitidos`;

    const jsonResponse = await page.evaluate(async (url) => {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include',
      });
      return { status: res.status, body: await res.text() };
    }, jsonUrl);

    let records = [];

    if (jsonResponse.status === 200) {
      try {
        const data = JSON.parse(jsonResponse.body);
        const linhas = data.linhas || data.documentos || [];
        records = linhas.map(l => ({
          documentNumber: l.numDocumento || l.numero || '',
          documentType: l.tipoDocumento || 'FR',
          documentDate: l.dataEmissao || l.data || '',
          customerNif: l.nifAdquirente || l.nifCliente || '',
          customerName: l.nomeAdquirente || l.nomeCliente || '',
          grossTotal: parseFloat(l.valorTotal || l.total || 0),
          taxPayable: parseFloat(l.valorIva || l.iva || 0),
          netTotal: parseFloat(l.valorBase || l.base || 0),
          status: l.situacao || 'N',
          atcud: l.atcud || '',
        }));
      } catch (e) {
        if (debug) console.error('JSON parse error:', e.message);
      }
    }

    // Step 8: Fallback to HTML table if JSON failed
    if (records.length === 0) {
      records = await page.evaluate(() => {
        const rows = document.querySelectorAll('table.listing tbody tr, table.dataTable tbody tr');
        return Array.from(rows).map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length < 5) return null;
          return {
            documentNumber: cells[0]?.textContent?.trim() || '',
            documentType: 'FR',
            documentDate: cells[1]?.textContent?.trim() || '',
            customerNif: cells[2]?.textContent?.trim() || '',
            customerName: cells[3]?.textContent?.trim() || '',
            grossTotal: parseFloat((cells[4]?.textContent || '0').replace(/[^\d.,-]/g, '').replace(',', '.')),
            taxPayable: 0,
            netTotal: 0,
            status: 'N',
            atcud: '',
          };
        }).filter(Boolean);
      });
    }

    if (debug) console.log(`Scraped ${records.length} recibos verdes for NIF ${nif}`);

    return { success: true, records, method: 'playwright' };
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { scrapeRecibosVerdesWithBrowser };
```

- [ ] **Step 3: Wire Playwright scraper into the connector routes**

In `services/at-connector/src/index.js`, update the `/v1/recibos-verdes` route handler to try Playwright when the HTTP scraper fails:

```javascript
// At the top, add import:
const { scrapeRecibosVerdesWithBrowser } = require('./playwrightScraper');

// In the /v1/recibos-verdes handler, after the HTTP scraper fails:
// Replace the current portalScraper call with:
let result;
try {
  // Try HTTP scraper first (faster, lighter)
  result = await scrapeRecibosVerdes(params);
} catch (httpError) {
  console.log('HTTP scraper failed, falling back to Playwright:', httpError.message);
  result = await scrapeRecibosVerdesWithBrowser(params);
}
```

- [ ] **Step 4: Commit**

```bash
git add services/at-connector/src/playwrightScraper.js services/at-connector/package.json services/at-connector/src/index.js
git commit -m "feat: add Playwright browser scraper for recibos verdes portal"
```

### Task 5b: Docker image with Chromium

**Files:**
- Create: `services/at-connector/Dockerfile.playwright`

- [ ] **Step 1: Create the extended Dockerfile**

```dockerfile
# services/at-connector/Dockerfile.playwright
FROM node:20-bookworm-slim

# Install Chromium and dependencies for Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src/ ./src/

EXPOSE 8787
CMD ["node", "src/index.js"]
```

- [ ] **Step 2: Build and test locally**

```bash
cd services/at-connector
docker build -f Dockerfile.playwright -t at-connector:3.0.0 .
docker run --rm -p 8787:8787 \
  -e CONNECTOR_TOKEN=$TOKEN \
  -e AT_KEY_PEM_PATH=/certs/key.pem \
  -e AT_CERT_PEM_PATH=/certs/cert.pem \
  -e AT_PUBLIC_CERT_PATH=/certs/at-public.pem \
  -e CHROMIUM_PATH=/usr/bin/chromium \
  at-connector:3.0.0
```

- [ ] **Step 3: Deploy to VPS**

```bash
ssh -i ~/.ssh/jarvis_vps ubuntu@137.74.112.68
cd /opt/iva-inteligente-mvp/services/at-connector
# Pull latest code, rebuild, restart
docker build -f Dockerfile.playwright -t at-connector:3.0.0 .
docker stop at-connector && docker rm at-connector
docker run -d --name at-connector --restart=unless-stopped \
  -p 127.0.0.1:8787:8787 \
  --env-file /etc/ivazen/at/connector.env \
  -e CHROMIUM_PATH=/usr/bin/chromium \
  -v /etc/ivazen/at/certs:/certs:ro \
  at-connector:3.0.0
```

- [ ] **Step 4: Test recibos verdes with a real client**

```bash
curl -s http://137.74.112.68:8788/v1/recibos-verdes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nif":"TEST_NIF","password":"TEST_PASS","startDate":"2026-01-01","endDate":"2026-03-31"}'
```

- [ ] **Step 5: Commit**

```bash
git add services/at-connector/Dockerfile.playwright
git commit -m "feat: Docker image with Chromium for Playwright portal scraping"
```

---

## Execution Order

| Order | Task | Dependencies | Time |
|-------|------|-------------|------|
| 1 | Task 1 (Sentry.setUser) | None | 5 min |
| 2 | Task 2a (VIES helpers + tests) | None | 15 min |
| 3 | Task 2b (VIES edge function + cron) | Task 2a | 30 min |
| 4 | Task 3 (Nightly classify) | None | 30 min |
| 5 | Task 4 (XML partial fix) | None | 20 min |
| 6 | Task 5a (Playwright scraper) | None | 30 min |
| 7 | Task 5b (Docker + deploy) | Task 5a | 20 min |

Tasks 1, 2a, 3, 4, 5a can run in parallel (no dependencies between them).
