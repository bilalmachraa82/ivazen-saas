import { test as base, expect } from '@playwright/test';

// Unified env var access — support both DEMO_* and TEST_USER_* naming
const TEST_EMAIL = process.env.DEMO_EMAIL || process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.DEMO_PASSWORD || process.env.TEST_USER_PASSWORD;

// Extend base test with authentication fixtures
export const test = base.extend<{
  authenticatedPage: ReturnType<typeof base['page']>;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Skip if no test credentials
    if (!TEST_EMAIL || !TEST_PASSWORD) {
      console.warn('Skipping authenticated tests - no credentials provided');
      await use(page);
      return;
    }

    // Perform login
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password|palavra-passe/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Wait for redirect
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    
    await use(page);
  },
});

export { expect };
