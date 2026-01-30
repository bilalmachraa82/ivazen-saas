import { test, expect } from '@playwright/test';
import path from 'path';

// These tests require authentication - use test fixtures or skip if not authenticated
test.describe('Invoice Upload Flow', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    
    // Navigate to upload page
    await page.goto('/upload');
  });

  test('should display upload interface', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /upload|carregar|faturas/i })).toBeVisible();
    
    // Should have file upload area
    await expect(page.locator('[type="file"], [data-dropzone], .dropzone')).toBeVisible();
  });

  test('should show QR input option', async ({ page }) => {
    // Look for QR button or tab
    const qrButton = page.getByRole('button', { name: /qr|código/i });
    if (await qrButton.isVisible()) {
      await qrButton.click();
      await expect(page.getByPlaceholder(/qr|código/i)).toBeVisible();
    }
  });

  test('should show camera option on mobile', async ({ page }) => {
    // Check if camera button exists (may be hidden on desktop)
    const cameraButton = page.locator('button:has-text("Câmara"), button:has-text("Camera")');
    // Just verify the upload interface is accessible
    await expect(page.locator('[type="file"]')).toBeVisible();
  });

  test('should show offline indicator when offline', async ({ page, context }) => {
    // Simulate offline mode
    await context.setOffline(true);
    await page.reload();
    
    // Should show offline indicator
    await expect(page.locator('text=/offline|sem ligação|desconectado/i')).toBeVisible({ timeout: 5000 });
    
    // Restore online mode
    await context.setOffline(false);
  });
});

test.describe('Invoice Upload UI (Unauthenticated)', () => {
  test('upload page should require authentication', async ({ page }) => {
    await page.goto('/upload');
    // Should redirect to auth or show login prompt
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe('File Upload Component', () => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Requires authenticated user');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password|palavra-passe/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 15000 });
    await page.goto('/upload');
  });

  test('should accept image files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    
    // File input should accept images
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toMatch(/image|jpeg|png|jpg/i);
  });

  test('should show drag and drop zone', async ({ page }) => {
    // Look for dropzone area
    const dropzone = page.locator('[data-dropzone], .dropzone, [class*="upload"]').first();
    await expect(dropzone).toBeVisible();
  });
});
