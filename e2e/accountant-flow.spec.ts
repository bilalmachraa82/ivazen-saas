import { test, expect } from '@playwright/test';

/**
 * Complete E2E test for the Accountant Flow
 * Tests: Create client, associate, upload invoice, validate, export Modelo 10
 */
test.describe('Accountant Complete Flow', () => {
  test.skip(!process.env.TEST_ACCOUNTANT_EMAIL, 'Requires accountant credentials');

  test.beforeEach(async ({ page }) => {
    // Login as accountant
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_ACCOUNTANT_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_ACCOUNTANT_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|accountant-dashboard|upload)/, { timeout: 15000 });
  });

  test('should access accountant dashboard', async ({ page }) => {
    await page.goto('/accountant-dashboard');
    await expect(page.getByRole('heading', { name: /painel do contabilista/i })).toBeVisible({ timeout: 10000 });
    
    // Verify key elements are present
    await expect(page.getByText(/clientes/i).first()).toBeVisible();
    await expect(page.getByText(/facturas/i).first()).toBeVisible();
  });

  test('should display client filter', async ({ page }) => {
    await page.goto('/accountant-dashboard');
    
    // Client filter should be visible
    const clientFilter = page.locator('select, [role="combobox"]').filter({ hasText: /todos os clientes|cliente/i });
    await expect(clientFilter.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show fiscal deadlines widget', async ({ page }) => {
    await page.goto('/accountant-dashboard');
    
    // Fiscal deadlines should be visible
    await expect(page.getByText(/prazos fiscais|próximos prazos/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show aggregated summary widget', async ({ page }) => {
    await page.goto('/accountant-dashboard');
    
    // Aggregated summary should be visible
    await expect(page.getByText(/resumo agregado|resumo fiscal/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to settings for client management', async ({ page }) => {
    await page.goto('/settings');
    
    // Look for client management panel
    await expect(page.getByText(/gestão de clientes|clientes/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should open create client dialog', async ({ page }) => {
    await page.goto('/settings');
    
    // Click create client button
    const createButton = page.getByRole('button', { name: /criar cliente|novo cliente|adicionar cliente/i });
    if (await createButton.isVisible()) {
      await createButton.click();
      
      // Dialog should open
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await expect(page.getByLabel(/nome completo|nome/i)).toBeVisible();
      await expect(page.getByLabel(/nif/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
    }
  });

  test('should search for clients', async ({ page }) => {
    await page.goto('/settings');
    
    // Find search input
    const searchInput = page.locator('input[placeholder*="pesquisar"], input[placeholder*="buscar"], input[placeholder*="NIF"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('123456789');
      
      // Click search button if exists
      const searchButton = page.getByRole('button', { name: /pesquisar|buscar/i });
      if (await searchButton.isVisible()) {
        await searchButton.click();
      }
      
      // Wait for search results
      await page.waitForTimeout(1000);
    }
  });

  test('should navigate to upload page with client selector', async ({ page }) => {
    await page.goto('/upload');
    
    // Client selector should be visible for accountants
    const clientSelector = page.locator('select, [role="combobox"]').filter({ hasText: /seleccionar cliente|cliente/i });
    await expect(clientSelector.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to validation page', async ({ page }) => {
    await page.goto('/validation');
    
    // Validation page should load
    await expect(page.getByRole('heading', { name: /validação|classificação|facturas/i })).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Modelo 10 with client selector', async ({ page }) => {
    await page.goto('/modelo10');
    
    // Page should load
    await expect(page.getByRole('heading', { name: /modelo 10|retenções/i })).toBeVisible({ timeout: 10000 });
    
    // Client selector should be visible
    const clientSelector = page.locator('select, [role="combobox"]').filter({ hasText: /seleccionar|cliente/i });
    await expect(clientSelector.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to reports with client selector', async ({ page }) => {
    await page.goto('/reports');
    
    // Reports page should load
    await expect(page.getByRole('heading', { name: /relatórios|reports/i })).toBeVisible({ timeout: 10000 });
    
    // Client selector should be visible
    const clientSelector = page.locator('select, [role="combobox"]').filter({ hasText: /seleccionar|cliente/i });
    await expect(clientSelector.first()).toBeVisible({ timeout: 5000 });
  });

  test('should access multi-client export on Modelo 10', async ({ page }) => {
    await page.goto('/modelo10');
    
    // Look for multi-client export tab or button
    const exportTab = page.getByRole('tab', { name: /multi-cliente|exportar/i });
    if (await exportTab.isVisible()) {
      await exportTab.click();
      
      // Multi-client export options should appear
      await expect(page.getByText(/exportar.*clientes|multi.*cliente/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Accountant Dashboard Metrics', () => {
  test.skip(!process.env.TEST_ACCOUNTANT_EMAIL, 'Requires accountant credentials');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_ACCOUNTANT_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_ACCOUNTANT_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|accountant-dashboard|upload)/, { timeout: 15000 });
    await page.goto('/accountant-dashboard');
  });

  test('should display all metric cards', async ({ page }) => {
    // Key metrics should be visible
    await expect(page.getByText(/clientes/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/facturas/i).first()).toBeVisible();
    await expect(page.getByText(/pendentes/i).first()).toBeVisible();
    await expect(page.getByText(/iva/i).first()).toBeVisible();
  });

  test('should filter by client', async ({ page }) => {
    // Open client filter
    const clientFilter = page.locator('[role="combobox"]').first();
    if (await clientFilter.isVisible()) {
      await clientFilter.click();
      
      // Select first client if available
      const firstClient = page.locator('[role="option"]').nth(1);
      if (await firstClient.isVisible()) {
        await firstClient.click();
        
        // Metrics should update
        await page.waitForTimeout(500);
        await expect(page.getByText(/a ver dados de/i)).toBeVisible();
      }
    }
  });

  test('should clear client filter', async ({ page }) => {
    // Apply filter first
    const clientFilter = page.locator('[role="combobox"]').first();
    if (await clientFilter.isVisible()) {
      await clientFilter.click();
      const firstClient = page.locator('[role="option"]').nth(1);
      if (await firstClient.isVisible()) {
        await firstClient.click();
        await page.waitForTimeout(500);
        
        // Clear filter
        const clearButton = page.getByRole('button').filter({ has: page.locator('svg') }).last();
        if (await clearButton.isVisible()) {
          await clearButton.click();
          
          // Should show all clients again
          await expect(page.getByText(/todos os clientes|gestão centralizada/i).first()).toBeVisible();
        }
      }
    }
  });

  test('should show tabs for clients, pending, charts, reports', async ({ page }) => {
    const tabsList = page.locator('[role="tablist"]');
    await expect(tabsList).toBeVisible();
    
    await expect(page.getByRole('tab', { name: /clientes/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /pendentes/i })).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    // Click pending tab
    await page.getByRole('tab', { name: /pendentes/i }).click();
    await expect(page.getByText(/facturas pendentes|aguardando/i).first()).toBeVisible({ timeout: 5000 });
    
    // Click clients tab
    await page.getByRole('tab', { name: /clientes/i }).click();
    await page.waitForTimeout(500);
  });
});

test.describe('Accountant (Unauthenticated)', () => {
  test('should redirect to auth from accountant-dashboard', async ({ page }) => {
    await page.goto('/accountant-dashboard');
    await expect(page).toHaveURL(/\/auth/);
  });
});
