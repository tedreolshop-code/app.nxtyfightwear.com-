import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const seed = async (page: Page) => {
  await isolateAsOwner(page); // tanpa ini tarikan Supabase menimpa seed dan tes mengubah data nyata
  await page.addInitScript(() => {
    localStorage.setItem('nxty_orders', JSON.stringify([{
      id: 'ord-edit', order_number: 'ORD/2026/07/005', customer_name: 'Dojo Uji', customer_phone: '0812',
      source: 'offline', date: '2026-07-29',
      items: [{ id: 'i1', product_id: 'prod-matras-2cm', product_name: 'Matras Beladiri Eva Foam 2cm', variant: 'Merah-Biru', qty: 2, price: 165000, subtotal: 330000 }],
      total: 330000, dp: 0, status: 'pending',
    }]));
  });
};

test('harga barang bisa diedit dari popup edit order', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await seed(page);
  await page.goto('/');
  await page.locator('#nav-tab-penjualan').click();
  await page.getByRole('button', { name: 'Order Non-Marketplace' }).click();
  await page.getByTitle('Edit order').click();

  const harga = page.locator('form table tbody input[type=number]').nth(1);
  await harga.fill('150000');
  await expect(page.getByText(/Total Tagihan:\s*Rp\s*300\.000/)).toBeVisible(); // total ikut turun

  await page.getByRole('button', { name: 'Simpan Perubahan Order' }).click();
  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem('nxty_orders') || '[]')[0].total)).toBe(300000);
});
