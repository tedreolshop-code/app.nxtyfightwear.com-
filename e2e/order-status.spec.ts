import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// Satu order Selesai atas produk prod-matras-2cm (stok awal seed 85, sudah dipotong 2 jadi 83)
const seed = async (page: Page) => {
  await isolateAsOwner(page); // tanpa ini, tarikan Supabase menimpa seed dan klik tes mengubah data nyata
  await page.addInitScript(() => {
    localStorage.setItem('nxty_orders', JSON.stringify([{
      id: 'ord-test', order_number: 'ORD/2026/07/001', customer_name: 'Dojo Uji', customer_phone: '0812',
      source: 'offline', date: '2026-07-27',
      items: [{ id: 'i1', product_id: 'prod-matras-2cm', product_name: 'Matras Beladiri Eva Foam 2cm', variant: 'Merah-Biru', qty: 2, price: 165000, subtotal: 330000 }],
      total: 330000, dp: 100000, status: 'completed',
    }]));
  });
};

const stokMatras = (page: Page) => page.evaluate(() => {
  const products = JSON.parse(localStorage.getItem('nxty_products') || '[]');
  return products.find((p: any) => p.id === 'prod-matras-2cm')?.stock;
});

// Semua confirm/alert diterima otomatis
const autoAcceptDialogs = (page: Page) => page.on('dialog', d => d.accept());

const badgeStatus = (page: Page) => page.getByRole('table').locator('tbody tr td').nth(6);

const bukaDaftarOrder = async (page: Page) => {
  autoAcceptDialogs(page);
  await page.goto('/');
  await page.locator('#nav-tab-penjualan').click();
  await page.getByRole('button', { name: 'Order Non-Marketplace' }).click();
  await expect(page.getByText('ORD/2026/07/001')).toBeVisible();
};

test('order Selesai bisa dibuka kembali dan stok gudang dipulihkan', async ({ page }) => {
  await seed(page);
  await bukaDaftarOrder(page);

  // Order Selesai: belum ada Edit/Hapus, tapi ada jalan keluar lewat Batalkan Penyelesaian
  await expect(page.getByRole('button', { name: 'Edit order' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hapus order' })).toHaveCount(0);

  const stokAwal = (await stokMatras(page)) ?? 85;

  await page.getByRole('button', { name: /Batalkan penyelesaian/ }).click();

  // Stok kembali 2 unit dan status jadi Pending, jadi Edit/Hapus muncul lagi
  await expect(badgeStatus(page)).toHaveText('Pending');
  expect(await stokMatras(page)).toBe(stokAwal + 2);
  await expect(page.getByRole('button', { name: 'Edit order' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hapus order' })).toBeVisible();
});

test('order dibatalkan bisa diaktifkan kembali tanpa mengubah stok', async ({ page }) => {
  await seed(page);
  await bukaDaftarOrder(page);

  // Selesai -> Pending dulu, baru dibatalkan
  await page.getByRole('button', { name: /Batalkan penyelesaian/ }).click();
  await expect(page.getByRole('button', { name: 'Batalkan order' })).toBeVisible();
  await page.getByRole('button', { name: 'Batalkan order' }).click();

  // Dibatalkan hilang dari filter Aktif, muncul lagi saat filter diganti
  await expect(page.getByText('ORD/2026/07/001')).toHaveCount(0);
  await page.locator('select').last().selectOption('cancelled');
  await expect(page.getByText('ORD/2026/07/001')).toBeVisible();

  const stokSebelum = await stokMatras(page);
  await page.getByRole('button', { name: 'Aktifkan kembali' }).click();

  // Sudah bukan Dibatalkan lagi, jadi hilang dari filter itu dan muncul sebagai Pending di filter Aktif
  await expect(page.getByText('ORD/2026/07/001')).toHaveCount(0);
  await page.locator('select').last().selectOption('active');
  await expect(badgeStatus(page)).toHaveText('Pending');

  expect(await stokMatras(page), 'aktifkan kembali tidak boleh menyentuh stok').toBe(stokSebelum);
});
