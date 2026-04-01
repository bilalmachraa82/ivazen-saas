import { test, expect } from '@playwright/test';
import { CAAD_CLIENT_ID, dismissOverlays, navigateAndWait } from './helpers/setup';

// Unified env var access — support both DEMO_* and TEST_USER_* naming
const TEST_EMAIL = process.env.DEMO_EMAIL || process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.DEMO_PASSWORD || process.env.TEST_USER_PASSWORD;

// Force desktop viewport so tab labels with hidden sm:inline are visible
test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Modelo 10 Flow', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Requires authenticated user');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.locator('#login-email').fill(TEST_EMAIL!);
    await page.locator('#login-password').fill(TEST_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    await page.evaluate(({ clientId }) => {
      localStorage.setItem('accountant-last-selected-client', clientId);
      localStorage.setItem(
        'accountant-last-selected-client-name',
        JSON.stringify({ name: 'CAAD' }),
      );
      localStorage.setItem('raquel-onboarding-completed', 'true');
      localStorage.setItem('ivazen-tour-completed', 'true');
    }, { clientId: CAAD_CLIENT_ID });
    await navigateAndWait(page, '/modelo-10');
    await dismissOverlays(page);
  });

  test('should display Modelo 10 page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^Modelo 10$/ })).toBeVisible();
    await expect(page.getByText(/declaração de rendimentos e retenções na fonte/i)).toBeVisible();
  });

  test('should show fiscal year selector', async ({ page }) => {
    await expect(page.getByText('Ano Fiscal:')).toBeVisible();
    await expect(
      page.locator('button[role="combobox"]').filter({ hasText: /^20\d{2}$/ }).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('should have tabs for dashboard, list, form, export, history', async ({ page }) => {
    const tabs = page.locator('[role="tablist"]');
    await expect(tabs).toBeVisible();

    for (const name of ['Retenções', 'Adicionar', 'Resumo', 'Dashboard', 'Exportar', 'Histórico']) {
      await expect(page.getByRole('tab', { name })).toBeVisible();
    }
  });

  test('should show summary statistics', async ({ page }) => {
    await page.getByRole('tab', { name: 'Resumo' }).click();
    await expect(page.getByText('Total Bruto')).toBeVisible();
    await expect(page.getByText('Total Retido')).toBeVisible();
    await expect(page.getByText(/resumo por beneficiário - quadro 5/i)).toBeVisible();
  });

  test('should navigate to form tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'Adicionar' }).click();
    await expect(page.getByRole('heading', { name: 'Adicionar Retenção' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#beneficiary_nif')).toBeVisible();
  });

  test('should show withholding form fields', async ({ page }) => {
    await page.getByRole('tab', { name: 'Adicionar' }).click();
    await expect(page.getByText(/nif do beneficiario/i)).toBeVisible();
    await expect(page.getByText(/categoria de rendimento/i)).toBeVisible();
    await expect(page.getByText(/valor bruto/i)).toBeVisible();
  });

  test('should validate NIF format', async ({ page }) => {
    await page.getByRole('tab', { name: 'Adicionar' }).click();

    const nifInput = page.locator('#beneficiary_nif');
    if (await nifInput.isVisible()) {
      await nifInput.fill('123');
      await nifInput.blur();

      await expect(nifInput).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('alert').filter({ hasText: /nif deve ter 9 digitos/i })).toBeVisible();
    }
  });

  test('should navigate to export tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'Exportar' }).click();
    await expect(page.getByText('Ficheiro Excel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('CSV para AT')).toBeVisible();
  });

  test('should show export button', async ({ page }) => {
    await page.getByRole('tab', { name: 'Exportar' }).click();
    await expect(page.getByRole('button', { name: 'Exportar Excel' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Exportar CSV (AT)' })).toBeVisible();
  });
});

test.describe('Modelo 10 (Unauthenticated)', () => {
  test('should redirect to auth', async ({ page }) => {
    await page.goto('/modelo-10');
    await expect(page).toHaveURL(/\/auth/);
  });
});
