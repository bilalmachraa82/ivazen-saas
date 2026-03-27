import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
  });

  test('should display login form by default', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /bem-vindo/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Entrar$/ })).toBeVisible();
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Entrar$/ })).toBeVisible();
  });

  test('should switch to signup form', async ({ page }) => {
    await page.getByRole('tab', { name: /criar conta/i }).click();
    await expect(page.locator('#signup-name')).toBeVisible();
    await expect(page.getByRole('button', { name: /criar conta/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    const emailInput = page.locator('#login-email');

    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(emailInput).toBeFocused();

    const validationMessage = await emailInput.evaluate((node) =>
      node instanceof HTMLInputElement ? node.validationMessage : '',
    );
    expect(validationMessage).not.toBe('');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.locator('#login-email').fill('invalid@test.com');
    await page.locator('#login-password').fill('wrongpassword');
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Should show error toast or message
    await expect(page.locator('[role="alert"], .toast, [data-sonner-toast]').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show password strength indicator on signup', async ({ page }) => {
    await page.getByRole('tab', { name: /criar conta/i }).click();
    await page.locator('#signup-password').fill('Test123!@#');

    await expect(page.getByText(/força da password/i)).toBeVisible();
    await expect(page.getByText(/forte|boa|razoável|fraca/i)).toBeVisible();
  });

  test('should redirect authenticated users from auth page', async ({ page, context }) => {
    // This test assumes a valid test user exists
    // Skip if no test credentials available
    test.skip(!process.env.TEST_USER_EMAIL, 'No test user credentials');
    
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard|upload)/, { timeout: 15000 });
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to auth when accessing protected route unauthenticated', async ({ page }) => {
    await page.goto('/upload');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should redirect to auth when accessing dashboard unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should redirect to auth when accessing validation unauthenticated', async ({ page }) => {
    await page.goto('/validation');
    await expect(page).toHaveURL(/\/auth/);
  });
});
