import { type Page, type BrowserContext, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// ── Config — all required via env vars, no hardcoded credentials ──
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`E2E: ${name} env var is required`);
  return value;
}

// Known client IDs
export const BILAL_CLIENT_ID = '5a994a12-8364-4320-ac35-e93f81edcf10';
export const CAAD_CLIENT_ID = '0ffd28d7-1ff0-4002-82fa-6ce9d7a47816';

export { BASE_URL };

/**
 * Authenticate via Supabase API and inject session into browser context.
 * Returns { page, context } — caller MUST close both in afterAll.
 */
export async function authenticateAndSetup(
  context: BrowserContext,
  opts: { clientId?: string; clientName?: string } = {},
): Promise<Page> {
  const { clientId = BILAL_CLIENT_ID, clientName = 'Bilal' } = opts;

  const email = requireEnv('DEMO_EMAIL', EMAIL);
  const password = requireEnv('DEMO_PASSWORD', PASSWORD);
  const supabaseUrl = requireEnv('VITE_SUPABASE_URL', SUPABASE_URL);
  const supabaseKey = requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY', SUPABASE_KEY);

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(`Login failed: ${error?.message || 'no session'}`);
  }

  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  const sessionPayload = JSON.stringify(data.session);

  await context.addInitScript(
    ({ authKey, authValue, cid, cname }) => {
      try {
        localStorage.setItem(authKey, authValue);
        if (cid && !localStorage.getItem('accountant-last-selected-client')) {
          localStorage.setItem('accountant-last-selected-client', cid);
          localStorage.setItem(
            'accountant-last-selected-client-name',
            JSON.stringify({ name: cname }),
          );
        }
        localStorage.setItem('raquel-onboarding-completed', 'true');
        localStorage.setItem('ivazen-tour-completed', 'true');
      } catch { /* ignore */ }
    },
    { authKey: storageKey, authValue: sessionPayload, cid: clientId, cname: clientName },
  );

  const page = await context.newPage();

  // Clear service worker cache
  await page.goto(BASE_URL, { waitUntil: 'commit', timeout: 15_000 });
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    if ('caches' in window) {
      const names = await caches.keys();
      for (const n of names) await caches.delete(n);
    }
  });

  return page;
}

/** Navigate to a path and wait for meaningful content. */
export async function navigateAndWait(page: Page, path: string, timeout = 30_000) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle', timeout });
  try {
    await page.waitForFunction(
      () => (document.body?.textContent || '').length > 200,
      { timeout: 15_000 },
    );
  } catch { /* proceed — page may have sparse content */ }
}

/**
 * Set selected client in localStorage.
 * NOTE: This only writes storage — the caller must navigate afterward
 * for React to pick up the change (e.g., `navigateAndWait(page, '/path')`).
 */
export async function switchClient(page: Page, clientId: string, clientName: string) {
  await page.evaluate(
    ({ id, name }) => {
      localStorage.setItem('accountant-last-selected-client', id);
      localStorage.setItem('accountant-last-selected-client-name', JSON.stringify({ name }));
    },
    { id: clientId, name: clientName },
  );
}

/** Dismiss tour and cookie modals if present. */
export async function dismissOverlays(page: Page) {
  const skipTour = page.locator('button:has-text("Saltar Tour")');
  if (await skipTour.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await skipTour.click();
    await page.waitForTimeout(500);
  }
  const acceptBtn = page.locator('button:has-text("Aceitar")');
  if (await acceptBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await acceptBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

/** Assert that a table has at least `min` rows in its tbody. */
export async function expectTableRows(page: Page, min: number) {
  const rows = page.locator('table tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(min);
  return count;
}
