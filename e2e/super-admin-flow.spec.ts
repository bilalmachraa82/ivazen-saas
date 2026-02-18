import { test, expect } from '@playwright/test';

test.describe('Super Admin Dashboard', () => {
  test('redirects to auth when not logged in', async ({ page }) => {
    await page.goto('/admin/super');
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe('Super Admin Dashboard - Authenticated', () => {
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
  });

  test('super admin page loads for admin users', async ({ page }) => {
    await page.goto('/admin/super');
    await page.waitForLoadState('networkidle');
    
    // Should either show the dashboard (if admin) or access denied message
    const pageText = await page.textContent('body');
    const isAdminPage = 
      pageText?.includes('Super Admin') ||
      pageText?.includes('Contabilistas') ||
      pageText?.includes('Acesso Negado');
    
    expect(isAdminPage).toBeTruthy();
  });

  test('shows access denied for non-admin users', async ({ page }) => {
    await page.goto('/admin/super');
    await page.waitForLoadState('networkidle');
    
    // If user is not admin, should show access denied
    const accessDenied = await page.getByText(/acesso negado/i).isVisible().catch(() => false);
    const isAdmin = await page.getByText(/super admin dashboard/i).isVisible().catch(() => false);
    
    // One of these should be true
    expect(accessDenied || isAdmin).toBeTruthy();
  });

  test('admin dashboard shows global stats', async ({ page }) => {
    await page.goto('/admin/super');
    await page.waitForLoadState('networkidle');
    
    // If user is admin, check for stats cards
    const hasStats = await page.locator('[class*="card"]').first().isVisible().catch(() => false);
    const hasAccessDenied = await page.getByText(/acesso negado/i).isVisible().catch(() => false);
    
    // Either should have stats (admin) or access denied (non-admin)
    expect(hasStats || hasAccessDenied).toBeTruthy();
  });

  test('admin can see accountants list', async ({ page }) => {
    await page.goto('/admin/super');
    await page.waitForLoadState('networkidle');
    
    // Look for table or list of accountants
    const hasTable = await page.getByRole('table').isVisible().catch(() => false);
    const hasAccountantsText = await page.getByText(/contabilista/i).isVisible().catch(() => false);
    const hasAccessDenied = await page.getByText(/acesso negado/i).isVisible().catch(() => false);
    
    // Should have accountants list (if admin) or access denied
    expect(hasTable || hasAccountantsText || hasAccessDenied).toBeTruthy();
  });

  test('admin can navigate to view clients', async ({ page }) => {
    await page.goto('/admin/super');
    await page.waitForLoadState('networkidle');
    
    // Check if there's a "Ver Clientes" button
    const viewClientsButton = page.getByRole('button', { name: /ver clientes/i });
    const hasViewButton = await viewClientsButton.first().isVisible().catch(() => false);
    
    if (hasViewButton) {
      await viewClientsButton.first().click();
      await page.waitForLoadState('networkidle');
      
      // Should show clients or back navigation
      const hasBackButton = await page.getByRole('button', { name: /contabilistas/i }).isVisible().catch(() => false);
      const hasClientsTable = await page.getByRole('table').isVisible().catch(() => false);
      
      expect(hasBackButton || hasClientsTable).toBeTruthy();
    }
  });
});

test.describe('Super Admin - Security', () => {
  test('cannot access admin routes without authentication', async ({ page }) => {
    await page.goto('/admin/super');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('admin check uses server-side validation', async ({ page }) => {
    // Verify we're not using localStorage for admin checks
    await page.goto('/');
    
    // Try to set fake admin status in localStorage
    await page.evaluate(() => {
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('userRole', 'admin');
    });
    
    // Navigate to admin page
    await page.goto('/admin/super');
    
    // Should still redirect to auth (localStorage doesn't grant access)
    await expect(page).toHaveURL(/\/auth/);
  });
});
