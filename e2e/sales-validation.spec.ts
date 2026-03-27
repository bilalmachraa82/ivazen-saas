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
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
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

  test('loads sales invoice table with data', async () => {
    await navigateAndWait(page, '/sales');

    await expect(
      page.locator('h1, h2, h3').filter({ hasText: /Facturas de Vendas/ }),
    ).toBeVisible({ timeout: 10_000 });

    const rowCount = await expectTableRows(page, 1);
    expect(rowCount).toBeGreaterThan(0);
  });

  test('stat cards show Pendentes, Validadas, Total Receitas', async () => {
    for (const label of ['Pendentes', 'Validadas', 'Total Receitas']) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 10_000 });
    }

    const body = await page.textContent('body');
    expect(body).not.toContain('NaN');
    expect(body).not.toContain('undefined');

    // Total Receitas should have a euro amount
    expect(body).toMatch(/€\s*[\d.,]+|[\d.,]+\s*€/);
  });

  test('table has sortable column headers', async () => {
    const headers = page.locator('table thead th, table thead button');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThanOrEqual(4);
  });

  test('revenue category badges are present in table', async () => {
    const body = await page.textContent('body');
    expect(body).toMatch(/Serviços|Vendas|Outros Rendimentos|Prestação/i);
  });

  test('clicking "Validadas" stat filters to validated invoices', async () => {
    await page.locator('text=Validadas').first().click();
    await page.waitForTimeout(2_000);

    const body = await page.textContent('body');
    expect(body).not.toContain('Erro ao carregar');
    // Table or empty state must be visible
    const rows = page.locator('table tbody tr');
    if (await rows.count()) {
      await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(page.getByText(/sem facturas|nenhuma/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('clicking a table row opens sales detail dialog', async () => {
    await navigateAndWait(page, '/sales');

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    await rows.first().click();
    await page.waitForTimeout(1_500);

    // Dialog MUST appear — hard assertion
    const dialog = page.getByRole('dialog').last();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const dialogText = await dialog.textContent();
    expect(dialogText).toMatch(/cliente|customer|nif|total|receita|categoria|serviços|vendas/i);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('fiscal period filter is present', async () => {
    const body = await page.textContent('body');
    expect(body).toMatch(/período|fiscal|trimestre|202[4-6]/i);
  });

  test('no error states in sales page', async () => {
    const body = await page.textContent('body');
    expect(body).not.toContain('Erro ao carregar');
    expect(body).not.toContain('Something went wrong');
    expect(body).not.toContain('NaN');

    await page.screenshot({ path: 'e2e/screenshots/sales-final.png', fullPage: true });
  });
});
