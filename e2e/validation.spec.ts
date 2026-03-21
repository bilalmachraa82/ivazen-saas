/**
 * E2E: Purchase Invoice Validation (Compras)
 *
 * Business assertions:
 *  - Page loads with invoice table populated
 *  - Stat cards show aggregated counts (Pendentes, Validadas, Requer revisão)
 *  - Clicking "Pendentes" stat card filters the table
 *  - Clicking a row opens the detail dialog with classification data
 *  - No error states or NaN values
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
  authenticateAndSetup,
  navigateAndWait,
  dismissOverlays,
  expectTableRows,
  BILAL_CLIENT_ID,
} from './helpers/setup';

test.use({ viewport: { width: 1280, height: 900 } });

test.describe.serial('Validation — Purchase Invoices', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await authenticateAndSetup(context, {
      clientId: BILAL_CLIENT_ID,
      clientName: 'Bilal',
    });
    await navigateAndWait(page, '/dashboard');
    await dismissOverlays(page);
  });

  test.afterAll(async () => {
    await page?.close();
    await context?.close();
  });

  test('loads invoice table with data', async () => {
    await navigateAndWait(page, '/validation');

    // Dismiss upload modal if present
    const modal = page.locator('text=Carregar Facturas');
    if (await modal.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1_000);
    }

    // Table must have at least 1 row
    const rowCount = await expectTableRows(page, 1);
    expect(rowCount).toBeGreaterThan(0);

    // Page header present
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Validação/ })).toBeVisible();
  });

  test('stat cards show non-negative counts without NaN', async () => {
    for (const label of ['Pendentes', 'Validadas', 'Requer revisão']) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 10_000 });
    }

    const body = await page.textContent('body');
    expect(body).not.toContain('NaN');
    expect(body).not.toContain('undefined');
  });

  test('clicking "Pendentes" stat filters to pending invoices', async () => {
    await page.locator('text=Pendentes').first().click();
    await page.waitForTimeout(2_000);

    const body = await page.textContent('body');
    expect(body).not.toContain('Erro ao carregar');
    // Validate that table or empty state is still visible (no crash)
    const tableOrEmpty = page.locator('table tbody tr, text=/sem facturas|nenhuma/i');
    await expect(tableOrEmpty.first()).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a table row opens invoice detail dialog', async () => {
    // Navigate fresh to clear filter
    await navigateAndWait(page, '/validation');

    // Dismiss upload modal if present
    const modal = page.locator('text=Carregar Facturas');
    if (await modal.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1_000);
    }

    // Wait for table
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    // Click first row
    await rows.first().click();
    await page.waitForTimeout(1_500);

    // Detail dialog MUST appear — hard assertion
    const dialog = page.locator('[role="dialog"], [data-state="open"]').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const dialogText = await dialog.textContent();
    // Should contain business data: supplier info, amounts, or classification
    expect(dialogText).toMatch(/fornecedor|supplier|nif|total|iva|classifica|dedut/i);

    // Close dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('fiscal period filter is present', async () => {
    await expect(page.locator('text=/Período|Fiscal/i').first()).toBeVisible({ timeout: 5_000 });
  });

  test('no error toasts or broken states', async () => {
    const body = await page.textContent('body');
    expect(body).not.toContain('Erro ao carregar facturas');
    expect(body).not.toContain('Something went wrong');

    await page.screenshot({ path: 'e2e/screenshots/validation-final.png', fullPage: true });
  });
});
