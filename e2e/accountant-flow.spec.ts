/**
 * E2E: Accountant Flow — Dashboard, Portfolio Readiness, Client Selection
 *
 * Business assertions:
 *  - Dashboard loads with portfolio readiness card
 *  - Readiness badges show client counts and are clickable
 *  - Selecting a client changes context and shows fiscal data
 *  - Centro Fiscal loads with obligation cards
 *  - Switching clients via localStorage changes displayed data
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
  authenticateAndSetup,
  navigateAndWait,
  dismissOverlays,
  switchClient,
  BILAL_CLIENT_ID,
  CAAD_CLIENT_ID,
} from './helpers/setup';

test.use({ viewport: { width: 1280, height: 900 } });

test.describe.serial('Accountant Flow — Portfolio & Client Navigation', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    // Start WITHOUT a pre-selected client to test portfolio view
    page = await authenticateAndSetup(context, {
      clientId: '', // No client selected initially
      clientName: '',
    });
  });

  test.afterAll(async () => {
    await page?.close();
    await context?.close();
  });

  test('dashboard loads with portfolio readiness card', async () => {
    // Clear selected client to see portfolio view
    await page.evaluate(() => {
      localStorage.removeItem('accountant-last-selected-client');
      localStorage.removeItem('accountant-last-selected-client-name');
    });
    await navigateAndWait(page, '/dashboard');
    await dismissOverlays(page);

    // Portfolio readiness card should be visible
    await expect(page.locator('text=/Estado da Carteira/i').first()).toBeVisible({ timeout: 15_000 });

    // Should show client count badge
    await expect(page.locator('text=/clientes/i').first()).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/accountant-portfolio.png', fullPage: true });
  });

  test('readiness badges are visible and show counts', async () => {
    const body = await page.textContent('body');

    const possibleLabels = [
      'Pronto', 'Parcial', 'Sem dados', 'Sem credenciais', 'Bloqueado', 'Importar',
    ];

    let foundBadges = 0;
    for (const label of possibleLabels) {
      if ((body || '').includes(label)) foundBadges++;
    }

    // At least 1 badge should be visible (portfolio has clients)
    expect(foundBadges).toBeGreaterThanOrEqual(1);
  });

  test('clicking a readiness badge shows filtered client list', async () => {
    const badges = page.locator('[aria-pressed]');
    const badgeCount = await badges.count();
    // Must have at least one clickable badge
    expect(badgeCount).toBeGreaterThan(0);

    // Click the first badge
    await badges.first().click();
    await page.waitForTimeout(1_000);

    // A client list or empty state MUST appear
    const clientList = page.locator('text=/NIF|Nenhum cliente encontrado/i');
    await expect(clientList.first()).toBeVisible({ timeout: 5_000 });

    // Toggle off
    await badges.first().click();
    await page.waitForTimeout(500);
  });

  test('selecting Bilal client navigates to Centro Fiscal', async () => {
    await switchClient(page, BILAL_CLIENT_ID, 'Bilal');
    await navigateAndWait(page, '/centro-fiscal');

    const body = await page.textContent('body');

    // Centro Fiscal should show obligation cards, not "select a client" prompt
    expect(body).not.toContain('Selecione um cliente');
    expect(body).toMatch(/compras|vendas|iva|segurança social|modelo 10/i);

    await page.screenshot({ path: 'e2e/screenshots/accountant-centro-fiscal-bilal.png', fullPage: true });
  });

  test('Centro Fiscal shows fiscal data for Bilal', async () => {
    const body = await page.textContent('body');
    expect(body).toMatch(/compras/i);
    expect(body).toMatch(/vendas/i);
  });

  test('switching to CAAD shows Modelo 10 data', async () => {
    await switchClient(page, CAAD_CLIENT_ID, 'CAAD');
    await navigateAndWait(page, '/modelo-10');

    await expect(page.getByRole('heading', { name: /lista de retenções/i })).toBeVisible({ timeout: 30_000 });

    const body = await page.textContent('body');

    // Should show category badges
    expect(body).toMatch(/Cat\.\s*[ABEFGHR]/i);

    // The list must report a non-zero retention count for the selected client.
    const countMatch = (body || '').match(/Lista de Retenções\s*\((\d[\d.,]*)/);
    if (countMatch) {
      const num = parseInt(countMatch[1].replace(/\./g, ''), 10);
      expect(num).toBeGreaterThan(0);
    }

    await page.screenshot({ path: 'e2e/screenshots/accountant-modelo10-caad.png', fullPage: true });
  });

  test('switching back to Bilal updates dashboard stats', async () => {
    await switchClient(page, BILAL_CLIENT_ID, 'Bilal');
    await navigateAndWait(page, '/dashboard');
    await dismissOverlays(page);

    const body = await page.textContent('body');

    expect(body).toMatch(/fluxo fiscal|compras|vendas|obrigações/i);
    expect(body).not.toContain('Something went wrong');
    expect(body).not.toContain('Erro ao carregar');
  });

  test('sidebar navigation items are correct for accountant', async () => {
    await expect(page.locator('[data-tour="nav-fiscal-center"]:visible').first()).toBeVisible();

    await page.getByRole('button', { name: /^Trabalho$/ }).click();
    await expect(page.locator('[data-tour="nav-sales"]:visible').first()).toBeVisible();

    await page.getByRole('button', { name: /^Importação$/ }).click();
    await expect(page.locator('[data-tour="nav-import-center"]:visible').first()).toBeVisible();

    for (const item of ['Glossário', 'Calculadora IVA']) {
      const link = await page.locator(`a:has-text("${item}")`).count();
      expect(link).toBe(0);
    }

    await page.screenshot({ path: 'e2e/screenshots/accountant-sidebar.png', fullPage: true });
  });
});
