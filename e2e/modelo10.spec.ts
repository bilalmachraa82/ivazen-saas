import { test, expect } from '@playwright/test';

test.describe('Modelo 10 Flow', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    await page.goto('/modelo10');
  });

  test('should display Modelo 10 page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /modelo 10|retenções/i })).toBeVisible();
  });

  test('should show fiscal year selector', async ({ page }) => {
    const yearSelector = page.locator('select, [role="combobox"]').filter({ hasText: /2024|2025/ });
    await expect(yearSelector.first()).toBeVisible({ timeout: 5000 });
  });

  test('should have tabs for dashboard, list, form, export, history', async ({ page }) => {
    const tabs = page.locator('[role="tablist"]');
    await expect(tabs).toBeVisible();
    
    // Check for expected tabs
    await expect(page.getByRole('tab', { name: /resumo|dashboard/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /lista|registos/i })).toBeVisible();
  });

  test('should show summary statistics', async ({ page }) => {
    // Look for summary cards
    await expect(page.locator('text=/total|bruto|retenção/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to form tab', async ({ page }) => {
    await page.getByRole('tab', { name: /novo|adicionar|form/i }).click();
    
    // Form fields should appear
    await expect(page.locator('input, select, [role="combobox"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show withholding form fields', async ({ page }) => {
    await page.getByRole('tab', { name: /novo|adicionar|form/i }).click();
    
    // Check for key form fields
    await expect(page.locator('text=/nif|beneficiário/i').first()).toBeVisible();
    await expect(page.locator('text=/categoria|rendimento/i').first()).toBeVisible();
    await expect(page.locator('text=/montante|valor/i').first()).toBeVisible();
  });

  test('should validate NIF format', async ({ page }) => {
    await page.getByRole('tab', { name: /novo|adicionar|form/i }).click();
    
    // Try to enter invalid NIF
    const nifInput = page.locator('input[name*="nif"], input[placeholder*="NIF"]').first();
    if (await nifInput.isVisible()) {
      await nifInput.fill('123');
      await nifInput.blur();
      
      // Should show validation error
      await expect(page.locator('text=/inválido|9 dígitos|invalid/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should navigate to export tab', async ({ page }) => {
    await page.getByRole('tab', { name: /exportar|export|csv/i }).click();
    
    // Export options should appear
    await expect(page.locator('text=/exportar|download|csv/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show export button', async ({ page }) => {
    await page.getByRole('tab', { name: /exportar|export|csv/i }).click();
    
    const exportButton = page.getByRole('button', { name: /exportar|download|csv/i });
    await expect(exportButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Modelo 10 (Unauthenticated)', () => {
  test('should redirect to auth', async ({ page }) => {
    await page.goto('/modelo10');
    await expect(page).toHaveURL(/\/auth/);
  });
});
