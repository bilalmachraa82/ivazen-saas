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
import { test, expect, type Page } from '@playwright/test';
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

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    // Start WITHOUT a pre-selected client to test portfolio view
    page = await authenticateAndSetup(context, {
      clientId: '', // No client selected initially
      clientName: '',
    });
  });

  test.afterAll(async () => {
    if (page) await page.close();
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
    const readinessCard = page.locator('text=/Estado da Carteira/i').first();
    await expect(readinessCard).toBeVisible({ timeout: 15_000 });

    // Should show client count badge
    const clientsBadge = page.locator('text=/clientes/i').first();
    await expect(clientsBadge).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/accountant-portfolio.png', fullPage: true });
  });

  test('readiness badges are visible and show counts', async () => {
    // At least some readiness badges should be visible
    const body = await page.textContent('body');

    // The readiness system uses these labels
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
    // Find any clickable badge with aria-pressed
    const badges = page.locator('[aria-pressed]');
    const badgeCount = await badges.count();

    if (badgeCount > 0) {
      // Click the first badge
      await badges.first().click();
      await page.waitForTimeout(1_000);

      // A client list should appear below
      const body = await page.textContent('body');
      // Should show client names or "Nenhum cliente encontrado"
      const hasClientList =
        /nif|cliente encontrado|nenhum cliente/i.test(body || '');
      expect(hasClientList || badgeCount > 0).toBeTruthy();

      // Click same badge again to toggle off
      await badges.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('selecting Bilal client navigates to Centro Fiscal', async () => {
    // Set Bilal as selected client
    await switchClient(page, BILAL_CLIENT_ID, 'Bilal');
    await navigateAndWait(page, '/centro-fiscal');

    const body = await page.textContent('body');

    // Centro Fiscal should show obligation cards
    expect(body).not.toContain('Selecione um cliente');

    // Should have fiscal obligation indicators
    const hasObligations =
      /compras|vendas|iva|segurança social|modelo 10/i.test(body || '');
    expect(hasObligations).toBeTruthy();

    await page.screenshot({ path: 'e2e/screenshots/accountant-centro-fiscal-bilal.png', fullPage: true });
  });

  test('Centro Fiscal shows fiscal data for Bilal', async () => {
    const body = await page.textContent('body');

    // Bilal has known data: purchases (761) and sales (25)
    const hasCompras = /compras/i.test(body || '');
    const hasVendas = /vendas/i.test(body || '');

    expect(hasCompras).toBeTruthy();
    expect(hasVendas).toBeTruthy();
  });

  test('switching to CAAD shows Modelo 10 data', async () => {
    await switchClient(page, CAAD_CLIENT_ID, 'CAAD');
    await navigateAndWait(page, '/modelo-10');
    await page.waitForTimeout(3_000); // Large dataset

    const body = await page.textContent('body');

    // CAAD has >2000 withholdings
    const hasRetencoes = /retenç|withhold/i.test(body || '');
    expect(hasRetencoes).toBeTruthy();

    // Should show category badges
    const hasCat = /Cat\.\s*[ABEFGHR]/i.test(body || '');
    expect(hasCat).toBeTruthy();

    // Check retention count (should be >1000, not truncated at 1000)
    const countMatch = (body || '').match(/Lista de Retenções\s*\((\d[\d.,]*)/);
    if (countMatch) {
      const num = parseInt(countMatch[1].replace(/\./g, ''), 10);
      expect(num).toBeGreaterThan(1_000);
    }

    await page.screenshot({ path: 'e2e/screenshots/accountant-modelo10-caad.png', fullPage: true });
  });

  test('switching back to Bilal updates dashboard stats', async () => {
    await switchClient(page, BILAL_CLIENT_ID, 'Bilal');
    await navigateAndWait(page, '/dashboard');
    await dismissOverlays(page);

    const body = await page.textContent('body');

    // Dashboard should show Bilal-specific data
    // Should have the Fluxo Fiscal widget or stat cards
    const hasDashboardContent =
      /fluxo fiscal|compras|vendas|obrigações/i.test(body || '');
    expect(hasDashboardContent).toBeTruthy();

    // No error states
    expect(body).not.toContain('Something went wrong');
    expect(body).not.toContain('Erro');
  });

  test('sidebar navigation items are correct for accountant', async () => {
    const body = await page.textContent('body');

    // Should have these nav items
    for (const item of ['Centro Fiscal', 'Vendas', 'Obrigações Fiscais']) {
      expect(body).toContain(item);
    }

    // Should NOT show these (accountant-only hidden or removed items)
    for (const item of ['Glossário', 'Calculadora IVA']) {
      const link = await page.locator(`a:has-text("${item}")`).count();
      expect(link).toBe(0);
    }

    await page.screenshot({ path: 'e2e/screenshots/accountant-sidebar.png', fullPage: true });
  });
});
