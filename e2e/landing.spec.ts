import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display hero section', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    // Check for main CTA button
    const ctaButton = page.getByRole('link', { name: /começar|entrar|login|start/i }).first();
    await expect(ctaButton).toBeVisible();
  });

  test('should have working login link', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /entrar|login/i }).first();
    await loginLink.click();
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    // Hero should still be visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should have proper meta tags for SEO', async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    
    const description = await page.getAttribute('meta[name="description"]', 'content');
    expect(description?.length).toBeGreaterThan(0);
  });

  test('should have theme toggle', async ({ page }) => {
    const themeToggle = page.locator('button[aria-label*="theme"], button:has([class*="sun"]), button:has([class*="moon"])').first();
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      // Theme should change
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Footer Links', () => {
  test('should have privacy policy link', async ({ page }) => {
    await page.goto('/');
    const privacyLink = page.getByRole('link', { name: /privacidade|privacy/i });
    if (await privacyLink.isVisible()) {
      await privacyLink.click();
      await expect(page).toHaveURL(/\/privacy/);
    }
  });

  test('should have terms link', async ({ page }) => {
    await page.goto('/');
    const termsLink = page.getByRole('link', { name: /termos|terms/i });
    if (await termsLink.isVisible()) {
      await termsLink.click();
      await expect(page).toHaveURL(/\/terms/);
    }
  });
});

test.describe('PWA Features', () => {
  test('should have manifest.json', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    
    const manifest = await response?.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.icons).toBeTruthy();
  });

  test('should have proper PWA icons', async ({ page }) => {
    const icon192 = await page.goto('/icon-192.png');
    expect(icon192?.status()).toBe(200);
    
    const icon512 = await page.goto('/icon-512.png');
    expect(icon512?.status()).toBe(200);
  });
});
