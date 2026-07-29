import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1366, height: 1000 }, isMobile: false, hasTouch: false });

test('penugasan karyawan per tahap', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await isolateAsOwner(page);
  await page.goto('/');
  await page.locator('#nav-tab-produksi').click();
  await page.getByRole('button', { name: 'Konveksi' }).click();
  await page.locator('select').first().selectOption({ index: 1 });

  await page.getByRole('button', { name: 'Potong', exact: true }).click();
  await page.screenshot({ path: 'test-results/stage-employee-1.png' });
  await page.getByText('Budi Hartono').click();

  await page.getByRole('button', { name: 'Jahit', exact: true }).click();
  await page.getByText('Dewi Lestari').click();
  await page.screenshot({ path: 'test-results/stage-employee-2.png' });

  await expect(page.getByText('2 karyawan ditugaskan')).toBeVisible();

  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.screenshot({ path: 'test-results/stage-employee-step2.png' });
  await page.locator('select').first().selectOption({ index: 1 });
  console.log('buttons:', await page.locator('button').allTextContents());
  await page.getByRole('button', { name: 'Lanjut' }).click();
  console.log('after click buttons:', await page.locator('button').allTextContents());
  await page.screenshot({ path: 'test-results/stage-employee-step3.png' });
  await expect(page.getByText('Karyawan per tahap:')).toBeVisible();
  await expect(page.locator('li, p', { hasText: 'Potong' }).filter({ hasText: 'Budi Hartono' })).toBeVisible();
  await expect(page.locator('li, p', { hasText: 'Jahit' }).filter({ hasText: 'Dewi Lestari' })).toBeVisible();
  await page.screenshot({ path: 'test-results/stage-employee-3.png' });
});
