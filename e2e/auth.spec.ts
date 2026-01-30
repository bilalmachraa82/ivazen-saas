import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
  });

  test('should display login form by default', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /entrar/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password|palavra-passe/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('should switch to signup form', async ({ page }) => {
    await page.getByRole('link', { name: /criar conta|registar/i }).click();
    await expect(page.getByRole('heading', { name: /criar conta|registar/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.getByRole('button', { name: /entrar/i }).click();
    // Should show validation or error message
    await expect(page.locator('text=/email|obrigatório|required/i')).toBeVisible({ timeout: 5000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('invalid@test.com');
    await page.getByLabel(/password|palavra-passe/i).fill('wrongpassword');
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Should show error toast or message
    await expect(page.locator('[role="alert"], .toast, [data-sonner-toast]').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show password strength indicator on signup', async ({ page }) => {
    await page.getByRole('link', { name: /criar conta|registar/i }).click();
    await page.getByLabel(/password|palavra-passe/i).first().fill('Test123!@#');
    
    // Password strength indicator should appear
    await expect(page.locator('[class*="strength"], [class*="progress"]')).toBeVisible({ timeout: 5000 });
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
    await page.goto('/validacao');
    await expect(page).toHaveURL(/\/auth/);
  });
});
