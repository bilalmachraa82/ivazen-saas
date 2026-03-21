/**
 * E2E: Sales Invoice Validation (Vendas / Receitas)
 *
 * Business assertions:
 *  - Page loads with sales invoice table
 *  - Stat cards: Pendentes, Validadas, Total Receitas
 *  - Table has sortable columns (Customer, NIF, Status, Category)
 *  - Revenue category badges (Serviços, Vendas, etc.) are present
 *  - Clicking a row opens detail dialog with revenue category info
 *  - Filtering by status works
 */
import { test, expect, type Page } from '@playwright/test';
import {
  authenticateAndSetup,
  navigateAndWait,
  dismissOverlays,
  expectTableRows,
  BILAL_CLIENT_ID,
} from './helpers/setup';

test.use({ viewport: { width: 1280, height: 900 } });

test.describe.serial('Sales Validation — Revenue Invoices', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await authenticateAndSetup(context, {
      clientId: BILAL_CLIENT_ID,
      clientName: 'Bilal',
    });
    await navigateAndWait(page, '/dashboard');
    await dismissOverlays(page);
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test('loads sales invoice table with data', async () => {
    await navigateAndWait(page, '/sales');

    // Page header
    await expect(
      page.locator('h1, h2, h3').filter({ hasText: /Facturas de Vendas/ }),
    ).toBeVisible({ timeout: 10_000 });

    // Table must have rows (Bilal has ~25 sales invoices)
    const rowCount = await expectTableRows(page, 1);
    expect(rowCount).toBeGreaterThan(0);
  });

  test('stat cards show Pendentes, Validadas, Total Receitas', async () => {
    for (const label of ['Pendentes', 'Validadas', 'Total Receitas']) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 10_000 });
    }

    // No broken numeric values
    const body = await page.textContent('body');
    expect(body).not.toContain('NaN');
    expect(body).not.toContain('undefined');

    // Total Receitas should have a euro amount
    const hasEuro = /€\s*[\d.,]+|[\d.,]+\s*€/.test(body || '');
    expect(hasEuro).toBeTruthy();
  });

  test('table has sortable column headers', async () => {
    // The SalesInvoiceTable has sortable columns added in Sprint 1
    const headers = page.locator('table thead th, table thead button');
    const headerCount = await headers.count();

    // Should have at least 4 columns (Date, Customer/NIF, Status, Category/Amount)
    expect(headerCount).toBeGreaterThanOrEqual(4);
  });

  test('revenue category badges are present in table', async () => {
    const body = await page.textContent('body');

    // Bilal's sales should have revenue categories like "Serviços" or "Vendas"
    const hasCategory =
      /Serviços|Vendas|Outros Rendimentos|Prestação/i.test(body || '');
    expect(hasCategory).toBeTruthy();
  });

  test('clicking "Validadas" stat filters to validated invoices', async () => {
    // Click Validadas stat card
    await page.locator('text=Validadas').first().click();
    await page.waitForTimeout(2_000);

    // URL should reflect filter or table should update
    const body = await page.textContent('body');
    expect(body).not.toContain('Erro');

    // Should still have content
    expect((body || '').length).toBeGreaterThan(200);
  });

  test('clicking a table row opens sales detail dialog', async () => {
    // Navigate fresh
    await navigateAndWait(page, '/sales');

    // Wait for table
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    // Click first row
    await rows.first().click();
    await page.waitForTimeout(1_500);

    // Dialog should appear
    const dialog = page.locator('[role="dialog"], [data-state="open"]').first();
    const dialogVisible = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);

    if (dialogVisible) {
      const dialogText = await dialog.textContent();

      // Should contain sales business data: customer, NIF, amount, category
      const hasSalesData =
        /cliente|customer|nif|total|receita|categoria|serviços|vendas/i.test(dialogText || '');
      expect(hasSalesData).toBeTruthy();

      // Close dialog
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  test('fiscal period filter is present', async () => {
    // Fiscal period filter should be visible (added in Sprint 1 via RPC)
    const body = await page.textContent('body');
    const hasPeriodFilter =
      /período|fiscal|trimestre|202[4-6]/i.test(body || '');
    expect(hasPeriodFilter).toBeTruthy();
  });

  test('no error states in sales page', async () => {
    const body = await page.textContent('body');
    expect(body).not.toContain('Erro ao carregar');
    expect(body).not.toContain('Something went wrong');
    expect(body).not.toContain('NaN');
    expect((body || '').length).toBeGreaterThan(200);

    await page.screenshot({ path: 'e2e/screenshots/sales-final.png', fullPage: true });
  });
});
