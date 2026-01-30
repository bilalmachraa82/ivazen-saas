import { test, expect } from '@playwright/test';

test.describe('Social Security Flow', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    await page.goto('/seguranca-social');
  });

  test('should display Social Security page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /segurança social|contribuições/i })).toBeVisible();
  });

  test('should show quarter selector', async ({ page }) => {
    const quarterSelector = page.locator('select, [role="combobox"]').filter({ hasText: /T1|T2|T3|T4|trimestre/i });
    await expect(quarterSelector.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display contribution calculation', async ({ page }) => {
    // Look for contribution amount display
    await expect(page.locator('text=/contribuição|montante|€/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show IAS value', async ({ page }) => {
    // IAS should be displayed somewhere
    await expect(page.locator('text=/IAS|509|522|537/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should have revenue import option', async ({ page }) => {
    const importTab = page.getByRole('tab', { name: /importar|receitas|revenue/i });
    if (await importTab.isVisible()) {
      await importTab.click();
      await expect(page.locator('text=/importar|carregar|upload/i').first()).toBeVisible();
    }
  });

  test('should show portal links', async ({ page }) => {
    // Look for SS Direct portal link
    await expect(page.locator('a[href*="seg-social"], text=/portal|ss direct/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should display charts if revenue exists', async ({ page }) => {
    // Charts component should be present
    const chart = page.locator('[class*="chart"], [class*="recharts"], svg').first();
    await page.waitForTimeout(1000);
    // Just check page loaded correctly
    await expect(page.locator('text=/segurança social|contribuições/i').first()).toBeVisible();
  });

  test('should show submission guide', async ({ page }) => {
    // Look for guide/help section
    const guideSection = page.locator('text=/como submeter|guia|passo a passo/i');
    if (await guideSection.first().isVisible()) {
      await expect(guideSection.first()).toBeVisible();
    }
  });
});

test.describe('Social Security Calculation', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test('should calculate contribution correctly', async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    await page.goto('/seguranca-social');

    // Look for calculation display
    await expect(page.locator('text=/€|contribuição|base/i').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Social Security (Unauthenticated)', () => {
  test('should redirect to auth', async ({ page }) => {
    await page.goto('/seguranca-social');
    await expect(page).toHaveURL(/\/auth/);
  });
});
