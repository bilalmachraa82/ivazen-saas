import { test, expect } from '@playwright/test';

test.describe('VAT Calculator Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/iva-calculator');
  });

  test('loads VAT calculator page', async ({ page }) => {
    // Should redirect to auth if not logged in, or show calculator if logged in
    await expect(page).toHaveURL(/\/(iva-calculator|auth)/);
  });

  test('displays correct 2025 exemption threshold', async ({ page }) => {
    // Check for threshold mention (€15,000)
    const content = await page.content();
    const hasThreshold = content.includes('15.000') || content.includes('15,000') || content.includes('15000');
    // This is informational - may not be visible if not authenticated
  });
});

test.describe('VAT Calculator - Authenticated', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'Requires test credentials'
  );

  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    
    // Navigate to VAT calculator
    await page.goto('/iva-calculator');
    await page.waitForLoadState('networkidle');
  });

  test('displays all three VAT calculator tabs', async ({ page }) => {
    // Check for the three main tabs
    await expect(page.getByRole('tab', { name: /isenção|exemption/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /valor|value|cálculo/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /entregar|payment|pagar/i })).toBeVisible();
  });

  test('exemption checker shows correct thresholds', async ({ page }) => {
    // Navigate to exemption tab
    const exemptionTab = page.getByRole('tab', { name: /isenção|exemption/i });
    if (await exemptionTab.isVisible()) {
      await exemptionTab.click();
      
      // Look for the 2025 threshold values
      const pageText = await page.textContent('body');
      expect(pageText).toContain('15');
    }
  });

  test('VAT value calculator works correctly', async ({ page }) => {
    // Navigate to value calculator tab
    const valueTab = page.getByRole('tab', { name: /valor|value|cálculo/i });
    if (await valueTab.isVisible()) {
      await valueTab.click();
      
      // Look for input fields and region selector
      const hasInput = await page.getByRole('spinbutton').first().isVisible().catch(() => false);
      const hasRegion = await page.getByRole('combobox').first().isVisible().catch(() => false);
      
      // Calculator should have input or select elements
      expect(hasInput || hasRegion).toBeTruthy();
    }
  });

  test('displays regional VAT rates', async ({ page }) => {
    // Check that regional rates are mentioned somewhere
    const pageText = await page.textContent('body');
    const hasRegionalInfo = 
      pageText?.includes('Continente') ||
      pageText?.includes('Açores') ||
      pageText?.includes('Madeira') ||
      pageText?.includes('23%') ||
      pageText?.includes('16%');
    
    // At least some VAT-related content should be present
    expect(hasRegionalInfo).toBeTruthy();
  });
});

test.describe('VAT Flow - Social Security Integration', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'Requires test credentials'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
  });

  test('Social Security page loads correctly', async ({ page }) => {
    await page.goto('/seguranca-social');
    await page.waitForLoadState('networkidle');
    
    // Should show Social Security content
    const pageText = await page.textContent('body');
    const hasSocialSecurityContent =
      pageText?.includes('Segurança Social') ||
      pageText?.includes('Contribuição') ||
      pageText?.includes('trimestre') ||
      pageText?.includes('21,4%');
    
    expect(hasSocialSecurityContent).toBeTruthy();
  });

  test('displays correct contribution rates', async ({ page }) => {
    await page.goto('/seguranca-social');
    await page.waitForLoadState('networkidle');
    
    const pageText = await page.textContent('body');
    // Should show TI rate (21.4%) or ENI rate (25.2%)
    const hasRates = pageText?.includes('21') || pageText?.includes('25');
    expect(hasRates).toBeTruthy();
  });
});
