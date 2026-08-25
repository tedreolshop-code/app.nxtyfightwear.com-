import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test('label lama +N output ikut diperbaiki', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_production_jobs', JSON.stringify([{
      id: 'job-lama', order_number: 'PROD/2026/0009', department_id: 'dept-konveksi',
      product_id: 'prod-body-protector', product_name: 'Body Protector Pencak Silat +1 output',
      variant: 'Size L', qty: 5, status: 'in_progress', current_stage: 'Potong',
      stages: [{ stage: 'Potong', status: 'in_progress' }], date: '2026-08-01',
      outputs: [
        { product_id: 'prod-body-protector', product_name: 'Body Protector Pencak Silat', variant: 'Size L', target_qty: 5 },
        { product_id: 'prod-samsak-120', product_name: 'Samsak Gantung 120cm', variant: 'Premium Hitam', target_qty: 2 },
      ],
    }]));
  });
  await page.goto('/');
  await page.locator('#nav-tab-produksi').click();
  await page.getByRole('button', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Body Protector Pencak Silat, Samsak Gantung 120cm' }).first()).toBeVisible();
  await expect(page.getByText('+1 output')).toHaveCount(0);
});
