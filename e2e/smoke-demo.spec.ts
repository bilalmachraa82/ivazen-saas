/**
 * Smoke Demo — quick end-to-end sanity check across core pages.
 * Uses shared auth helpers. Proper expect() assertions (not console.log).
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
  authenticateAndSetup,
  navigateAndWait,
  dismissOverlays,
  switchClient,
  expectTableRows,
  BILAL_CLIENT_ID,
  CAAD_CLIENT_ID,
  BASE_URL,
} from './helpers/setup';

test.use({ viewport: { width: 1280, height: 900 } });

test.describe.serial('Smoke Demo', () => {
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

  test('1. Bilal — Centro Fiscal', async () => {
    await navigateAndWait(page, '/centro-fiscal');
    const body = await page.textContent('body');

    expect(body).not.toContain('Selecione um cliente');
    expect(body).toMatch(/compras/i);
    expect(body).toMatch(/vendas/i);

    await page.screenshot({ path: 'e2e/screenshots/01-centro-fiscal-bilal.png', fullPage: true });
  });

  test('2. Bilal — Vendas', async () => {
    await navigateAndWait(page, '/sales');

    const rowCount = await expectTableRows(page, 1);
    expect(rowCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e/screenshots/02-vendas-bilal.png', fullPage: true });
  });

  test('3. Bilal — Seguranca Social', async () => {
    await navigateAndWait(page, '/seguranca-social');
    const body = await page.textContent('body');

    expect(body).not.toContain('Selecione um cliente');
    expect(body).toMatch(/segurança social|contribuiç/i);

    await page.screenshot({ path: 'e2e/screenshots/03-ss-bilal.png', fullPage: true });
  });

  test('4. Bilal — Compras', async () => {
    await navigateAndWait(page, '/validation');

    // Dismiss upload modal if present
    const modal = page.locator('text=Carregar Facturas');
    if (await modal.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1_000);
    }

    const rowCount = await expectTableRows(page, 1);
    expect(rowCount).toBeGreaterThan(0);

    const body = await page.textContent('body');
    expect(body).not.toContain('Erro ao carregar');

    await page.screenshot({ path: 'e2e/screenshots/04-compras-bilal.png', fullPage: true });
  });

  test('5. CAAD — Modelo 10', async () => {
    await switchClient(page, CAAD_CLIENT_ID, 'CAAD');
    await navigateAndWait(page, '/modelo-10');

    await expect(page.getByRole('heading', { name: /lista de retenções/i })).toBeVisible({ timeout: 30_000 });

    const body = await page.textContent('body');
    expect(body).toMatch(/Cat\.\s*[ABEFGHR]/i);

    await page.screenshot({ path: 'e2e/screenshots/05-modelo10.png', fullPage: true });
  });

  test('6. Sidebar check', async () => {
    await switchClient(page, BILAL_CLIENT_ID, 'Bilal');
    await navigateAndWait(page, '/dashboard');
    await dismissOverlays(page);

    await expect(page.locator('[data-tour="nav-fiscal-center"]:visible').first()).toBeVisible();

    await page.getByRole('button', { name: /^Trabalho$/ }).click();
    await expect(page.locator('[data-tour="nav-sales"]:visible').first()).toBeVisible();

    await page.getByRole('button', { name: /^Importação$/ }).click();
    await expect(page.locator('[data-tour="nav-import-center"]:visible').first()).toBeVisible();

    // Should NOT have hidden items
    for (const item of ['Glossário', 'Calculadora IVA']) {
      expect(await page.locator(`a:has-text("${item}")`).count()).toBe(0);
    }

    await page.screenshot({ path: 'e2e/screenshots/06-sidebar.png', fullPage: true });
  });

  test('7. Reconciliacao', async () => {
    await navigateAndWait(page, '/reconciliation');
    const body = await page.textContent('body');

    expect(body).not.toContain('Selecione um cliente');
    expect(body).toMatch(/reconcilia/i);

    await page.screenshot({ path: 'e2e/screenshots/07-reconciliacao.png', fullPage: true });
  });

  test('8. Centro Importacao', async () => {
    await navigateAndWait(page, '/centro-importacao');
    const body = await page.textContent('body');

    expect(body).toMatch(/importa/i);

    await page.screenshot({ path: 'e2e/screenshots/08-importacao.png', fullPage: true });
  });
});
