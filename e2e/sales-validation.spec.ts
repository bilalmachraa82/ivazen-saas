import { test, expect } from '@playwright/test';

test.describe('Sales Invoice Validation', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
  });

  test('should display sales validation interface', async ({ page }) => {
    await page.goto('/sales');
    
    // Should show heading
    await expect(page.getByRole('heading', { name: /vendas|receitas/i })).toBeVisible();
  });

  test('should show filter controls', async ({ page }) => {
    await page.goto('/sales');
    
    // Should have status filter
    const statusFilter = page.locator('button:has-text("Estado"), button:has-text("Status"), [data-testid="status-filter"]');
    await expect(statusFilter.first()).toBeVisible();
    
    // Should have period filter
    const periodFilter = page.locator('button:has-text("Período"), button:has-text("Period"), [data-testid="period-filter"]');
    await expect(periodFilter.first()).toBeVisible();
  });

  test('should show revenue category classification options in dialog', async ({ page }) => {
    await page.goto('/sales');
    
    // Wait for table to load
    await page.waitForSelector('table, [data-testid="empty-state"]', { timeout: 10000 });
    
    // Check if there are invoices
    const rows = page.locator('tbody tr');
    const hasInvoices = await rows.count() > 0;
    
    if (hasInvoices) {
      // Click first invoice row
      await rows.first().click();
      
      // Should open detail dialog with classification options
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
      
      // Should show revenue category options
      await expect(page.locator('text=/prestação.*serviços|vendas|outros.*rendimentos/i').first()).toBeVisible();
    }
  });
});

test.describe('Sales Validation (Unauthenticated)', () => {
  test('sales page should require authentication', async ({ page }) => {
    await page.goto('/sales');
    await expect(page).toHaveURL(/\/auth/);
  });
});
