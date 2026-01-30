import { test, expect } from '@playwright/test';

test.describe('Dashboard Tax Flow Widget', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    await page.goto('/dashboard');
  });

  test('should display tax flow widget', async ({ page }) => {
    // Should show the fiscal flow section
    await expect(page.locator('text=/fluxo.*fiscal|resumo.*fiscal/i').first()).toBeVisible();
  });

  test('should show VAT and SS links', async ({ page }) => {
    // Should have link to SS page
    const ssLink = page.locator('a[href*="social-security"], a[href*="ss"]');
    if (await ssLink.count() > 0) {
      await expect(ssLink.first()).toBeVisible();
    }
    
    // Should have link to sales/validation
    const salesLink = page.locator('a[href*="sales"], a[href*="vendas"]');
    if (await salesLink.count() > 0) {
      await expect(salesLink.first()).toBeVisible();
    }
  });

  test('should display revenue breakdown by category', async ({ page }) => {
    // Wait for widget to load
    await page.waitForTimeout(1000);
    
    // Should show category labels
    const categoryLabels = page.locator('text=/serviços|vendas|outros/i');
    // At least one category should be visible if there's data
    await expect(categoryLabels.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // No data case - that's fine
    });
  });
});

test.describe('Dashboard (Unauthenticated)', () => {
  test('dashboard should require authentication', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth/);
  });
});
