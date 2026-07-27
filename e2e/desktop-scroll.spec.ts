import { test, expect } from '@playwright/test';

// Root memakai h-dvh untuk semua ukuran layar, jadi layout desktop ikut diperiksa.
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test('desktop: area konten dan sidebar tetap muat di layar', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('nxty_session', JSON.stringify({ role: 'owner', name: 'H. Ari Gunawan', employeeId: 'emp-owner' }));
  });
  await page.goto('/');

  for (const selector of ['main > div.overflow-y-auto', 'aside > nav']) {
    const el = page.locator(selector);
    await expect(el).toBeVisible();
    const bottom = await el.evaluate(node => node.getBoundingClientRect().bottom);
    expect(bottom, `${selector} melewati bawah layar`).toBeLessThanOrEqual(900 + 1);
  }
});
