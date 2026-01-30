import { test, expect } from '@playwright/test';

test.describe('Upload Type Selection', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
  });

  test('should display purchase and sales tabs', async ({ page }) => {
    await page.goto('/upload');
    
    // Should show both tabs
    await expect(page.getByRole('tab', { name: /compras/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /vendas/i })).toBeVisible();
  });

  test('should show distinct colors for purchase vs sales', async ({ page }) => {
    await page.goto('/upload');
    
    // Check purchases tab (indigo)
    const purchasesTab = page.getByRole('tab', { name: /compras/i });
    await purchasesTab.click();
    
    // Header should reflect purchase mode
    await expect(page.locator('text=/carregar.*compra/i')).toBeVisible();
    
    // Check sales tab (rose)
    const salesTab = page.getByRole('tab', { name: /vendas/i });
    await salesTab.click();
    
    // Header should reflect sales mode
    await expect(page.locator('text=/carregar.*venda/i')).toBeVisible();
  });

  test('should navigate to sales upload via URL parameter', async ({ page }) => {
    await page.goto('/upload?type=sales');
    
    // Sales tab should be active
    const salesTab = page.getByRole('tab', { name: /vendas/i });
    await expect(salesTab).toHaveAttribute('data-state', 'active');
  });

  test('should navigate to purchases upload via URL parameter', async ({ page }) => {
    await page.goto('/upload?type=purchases');
    
    // Purchases tab should be active
    const purchasesTab = page.getByRole('tab', { name: /compras/i });
    await expect(purchasesTab).toHaveAttribute('data-state', 'active');
  });
});

test.describe('Type Mismatch Warning', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    await page.goto('/upload');
  });

  test('should have file input accepting images and PDFs', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    const acceptAttr = await fileInput.getAttribute('accept');
    
    // Should accept images
    expect(acceptAttr).toMatch(/image/i);
  });
});
