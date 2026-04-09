import { expect, type Page } from '@playwright/test';

export async function dismissUploadModalIfPresent(page: Page) {
  const modal = page.locator('text=Carregar Facturas');
  if (await modal.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(750);
  }
}

export async function expectHealthyAppShell(page: Page) {
  const body = (await page.textContent('body')) || '';

  expect(body).not.toContain('NaN');
  expect(body).not.toContain('undefined');
  expect(body).not.toContain('Something went wrong');
  expect(body).not.toContain('ReferenceError');
  expect(body).not.toContain('Erro ao carregar');
}

export async function expectRowsOrEmptyState(page: Page) {
  const rows = page.locator('table tbody tr');

  if (await rows.first().isVisible({ timeout: 10_000 }).catch(() => false)) {
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    return count;
  }

  await expect(
    page.locator(
      'text=/Nenhuma factura|Nenhuma fatura|Sem facturas|Sem faturas|Sem duplicados|Tudo reconciliado|Nenhum documento duplicado/i',
    ).first(),
  ).toBeVisible({ timeout: 10_000 });

  return 0;
}

interface UrlStateExpectation {
  expectedIncludes?: string[];
  forbiddenIncludes?: string[];
}

export async function clickStatCardAndAssertUrlState(
  page: Page,
  label: string,
  {
    expectedIncludes = [],
    forbiddenIncludes = [],
  }: UrlStateExpectation,
) {
  await page.locator(`text=${label}`).first().click();

  await page.waitForFunction(
    ({ expected, forbidden }) => {
      const query = window.location.search;
      return expected.every((value) => query.includes(value))
        && forbidden.every((value) => !query.includes(value));
    },
    { expected: expectedIncludes, forbidden: forbiddenIncludes },
    { timeout: 10_000 },
  );

  await page.waitForTimeout(750);
  await expectHealthyAppShell(page);
  await expectRowsOrEmptyState(page);
}
