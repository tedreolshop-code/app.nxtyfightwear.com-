import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_orders', JSON.stringify([
      { id: 'ord-1', order_number: 'ORD/2026/07/001', customer_name: 'Cahya', customer_phone: '0812', source: 'offline', date: '2026-07-10', items: [], total: 900000, dp: 0, status: 'pending' },
      { id: 'ord-2', order_number: 'ORD/2026/07/002', customer_name: 'Anwar', customer_phone: '0812', source: 'offline', date: '2026-07-25', items: [], total: 300000, dp: 0, status: 'pending' },
    ]));
  });
};

// Kolom pertama = Tanggal, kolom kedua = No. Order
const nomorBarisPertama = (page: Page) => page.getByRole('table').locator('tbody tr').first().locator('td').nth(1);
const pilihUrutan = (page: Page, label: string) => page.getByTitle('Urutkan daftar pesanan').selectOption({ label });

test('daftar pesanan bisa diurutkan', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await seed(page);
  await page.goto('/');
  await page.locator('#nav-tab-penjualan').click();
  await page.getByRole('button', { name: 'Order Non-Marketplace' }).click();

  await expect(nomorBarisPertama(page)).toHaveText('ORD/2026/07/002'); // default: tanggal terbaru
  await pilihUrutan(page, 'Tanggal Terlama');
  await expect(nomorBarisPertama(page)).toHaveText('ORD/2026/07/001');
  await pilihUrutan(page, 'Total Terbesar');
  await expect(nomorBarisPertama(page)).toHaveText('ORD/2026/07/001');
  await pilihUrutan(page, 'Pelanggan A-Z');
  await expect(nomorBarisPertama(page)).toHaveText('ORD/2026/07/002'); // Anwar sebelum Cahya
});
