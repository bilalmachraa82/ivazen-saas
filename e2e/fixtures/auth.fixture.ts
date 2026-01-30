import { test as base, expect } from '@playwright/test';

// Extend base test with authentication fixtures
export const test = base.extend<{
  authenticatedPage: ReturnType<typeof base['page']>;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Skip if no test credentials
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      console.warn('Skipping authenticated tests - no credentials provided');
      await use(page);
      return;
    }

    // Perform login
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Wait for redirect
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    
    await use(page);
  },
});

export { expect };
