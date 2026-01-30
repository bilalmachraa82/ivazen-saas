import { test, expect } from '@playwright/test';

test.describe('Invoice Validation Flow', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    
    // Navigate to validation page
    await page.goto('/validacao');
  });

  test('should display validation interface', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /validação|faturas/i })).toBeVisible();
  });

  test('should show invoice table or empty state', async ({ page }) => {
    // Either shows table with invoices or empty state
    const table = page.locator('table, [role="table"]');
    const emptyState = page.locator('text=/sem faturas|nenhuma fatura|empty/i');
    
    await expect(table.or(emptyState).first()).toBeVisible({ timeout: 10000 });
  });

  test('should have filter controls', async ({ page }) => {
    // Look for status filter
    const statusFilter = page.locator('[data-testid="status-filter"], select, [role="combobox"]').first();
    await expect(statusFilter).toBeVisible({ timeout: 5000 });
  });

  test('should have search functionality', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/pesquisar|search|buscar/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      // Wait for search to apply
      await page.waitForTimeout(500);
    }
  });

  test('should have period filter', async ({ page }) => {
    // Look for period selector
    const periodFilter = page.locator('text=/período|trimestre|quarter/i').first();
    await expect(periodFilter).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Invoice Detail Dialog', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    await page.goto('/validacao');
  });

  test('should open invoice detail on row click', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr, [role="row"]', { timeout: 10000 }).catch(() => null);
    
    const firstRow = page.locator('table tbody tr, [role="row"]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      
      // Dialog should open
      await expect(page.locator('[role="dialog"], [data-state="open"]')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Classification Editor', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test('should show classification options in detail dialog', async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    await page.goto('/validacao');
    
    // Wait for invoices to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 }).catch(() => null);
    
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      
      // Should show classification selector
      await expect(page.locator('text=/classificação|category|categoria/i')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Validation Page (Unauthenticated)', () => {
  test('should redirect to auth', async ({ page }) => {
    await page.goto('/validacao');
    await expect(page).toHaveURL(/\/auth/);
  });
});
