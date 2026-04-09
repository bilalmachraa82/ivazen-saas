import { test, expect, type BrowserContext, type Page } from '@playwright/test';

import {
  authenticateAndSetup,
  navigateAndWait,
  dismissOverlays,
  BILAL_CLIENT_ID,
} from './helpers/setup';
import {
  dismissUploadModalIfPresent,
  expectHealthyAppShell,
  expectRowsOrEmptyState,
  clickStatCardAndAssertUrlState,
} from './helpers/meetingSmoke';

test.use({ viewport: { width: 1280, height: 900 } });

test.describe.serial('Meeting 2026-03-30 regressions — production smoke', () => {
  let context: BrowserContext;
  let page: Page;

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

  test('compras stat cards remain interactive after opening Importadas 24h', async () => {
    await navigateAndWait(page, '/validation');
    await dismissUploadModalIfPresent(page);
    await expectRowsOrEmptyState(page);

    await clickStatCardAndAssertUrlState(page, 'Importadas 24h', {
      expectedIncludes: ['recent=24h'],
      forbiddenIncludes: ['status=pending', 'status=validated'],
    });

    await clickStatCardAndAssertUrlState(page, 'Pendentes', {
      expectedIncludes: ['status=pending'],
      forbiddenIncludes: ['recent=24h'],
    });

    await clickStatCardAndAssertUrlState(page, 'Validadas', {
      expectedIncludes: ['status=validated'],
      forbiddenIncludes: ['recent=24h'],
    });

    await expectHealthyAppShell(page);
  });

  test('compras tabs for duplicados and reconciliação load without losing client context', async () => {
    await navigateAndWait(page, '/validation');
    await dismissUploadModalIfPresent(page);

    await page.getByRole('tab', { name: /Duplicados/i }).click();
    await expect(page.locator('text=/Gestão de Duplicados|Sem duplicados|duplicado\\(s\\)/i').first())
      .toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Selecione um cliente')).toHaveCount(0);

    await page.getByRole('tab', { name: /Reconciliação/i }).click();
    await expect(page.locator('text=/Reconciliação AT|Tudo reconciliado|Divergência|duplicado/i').first())
      .toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Selecione um cliente')).toHaveCount(0);

    await expectHealthyAppShell(page);
  });

  test('compras detail dialog still opens with invoice data', async () => {
    await navigateAndWait(page, '/validation');
    await dismissUploadModalIfPresent(page);
    await expectRowsOrEmptyState(page);

    const rows = page.locator('table tbody tr');
    await rows.first().click();

    const dialog = page.getByRole('dialog').last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText(/fornecedor|supplier|nif|total|iva|classifica/i);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('vendas page keeps status filters interactive and stable', async () => {
    await navigateAndWait(page, '/sales');
    await expectRowsOrEmptyState(page);

    await clickStatCardAndAssertUrlState(page, 'Validadas', {
      expectedIncludes: ['status=validated'],
      forbiddenIncludes: ['recent=24h'],
    });

    await clickStatCardAndAssertUrlState(page, 'Pendentes', {
      expectedIncludes: ['status=pending'],
      forbiddenIncludes: ['recent=24h'],
    });

    await expect(page.locator('text=/Total Receitas/i').first()).toBeVisible({ timeout: 10_000 });
    await expectHealthyAppShell(page);
  });

  test('segurança social declaration loads without crash and keeps accountant context', async () => {
    await navigateAndWait(page, '/seguranca-social');

    await expect(page.locator('text=Selecione um cliente')).toHaveCount(0);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Segurança Social/i }).first())
      .toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: /Declaração/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=/Rendimentos por mês|Contribuição|Contribuiç/i').first())
      .toBeVisible({ timeout: 15_000 });

    await expectHealthyAppShell(page);
  });
});
