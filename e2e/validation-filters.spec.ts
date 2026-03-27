import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import {
  authenticateAndSetup,
  navigateAndWait,
  dismissOverlays,
  BILAL_CLIENT_ID,
} from './helpers/setup';

test.use({ viewport: { width: 1280, height: 900 } });

test.describe.serial('Validation Filters', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await authenticateAndSetup(context, {
      clientId: BILAL_CLIENT_ID,
      clientName: 'Bilal',
    });
    await navigateAndWait(page, '/validation');
    await dismissOverlays(page);
  });

  test.afterAll(async () => {
    await page?.close();
    await context?.close();
  });

  test('purchase filters keep the selected values after rerender', async () => {
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20_000 });

    const statusFilter = page.locator('button[role="combobox"]').filter({ hasText: 'Todos os estados' }).first();
    await statusFilter.click();
    await page.getByRole('option', { name: 'Validada' }).click();
    await page.waitForTimeout(1_000);
    await expect(page.locator('button[role="combobox"]').filter({ hasText: 'Validada' }).first()).toBeVisible();

    const yearFilter = page.locator('button[role="combobox"]').filter({ hasText: 'Todos os anos' }).first();
    await yearFilter.click();
    await page.getByRole('option', { name: 'Ano 2025' }).click();
    await page.waitForTimeout(1_000);
    await expect(page.locator('button[role="combobox"]').filter({ hasText: 'Ano 2025' }).first()).toBeVisible();

    const importFilter = page.locator('button[role="combobox"]').filter({ hasText: 'Todas as importações' }).first();
    await importFilter.click();
    await page.getByRole('option', { name: 'Últimas 24 horas' }).click();
    await page.waitForTimeout(1_000);
    await expect(page.locator('button[role="combobox"]').filter({ hasText: 'Últimas 24 horas' }).first()).toBeVisible();
  });
});
