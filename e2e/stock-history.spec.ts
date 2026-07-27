import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_stock_movements', JSON.stringify([
      { id: 'm1', type: 'barang_jadi_masuk', department_id: 'dept-eva-foam', item_id: 'prod-matras-2cm', item_name: 'Matras 2cm', amount: 10, reference: 'Selesai Produksi PROD/1', created_at: '2026-07-27T10:00:00+07:00' },
      { id: 'm2', type: 'bahan_keluar', department_id: 'dept-konveksi', item_id: 'mat-foam-2cm', item_name: 'Eva Foam Sheet 2cm Raw', amount: 5, reference: 'Order Produksi PROD/1', created_at: '2026-07-26T09:00:00+07:00' },
      { id: 'm3', type: 'barang_jadi_keluar', item_id: 'prod-matras-2cm', item_name: 'Matras 2cm', amount: 2, reference: 'Terjual - Order ORD/9', created_at: '2026-07-25T08:00:00+07:00' },
    ]));
  });
};

const bukaRiwayatMutasi = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-produksi').click();
  await page.getByRole('button', { name: 'Riwayat & Stok' }).click();
  await page.getByRole('button', { name: 'Riwayat Mutasi' }).click();
};

test('Riwayat Mutasi tampil sebagai tabel dan bisa difilter per jenis item', async ({ page }) => {
  await seed(page);
  await bukaRiwayatMutasi(page);

  // Bentuknya tabel dengan kolom yang sama polanya seperti tab stok lain
  const header = page.getByRole('table').locator('thead th');
  await expect(header).toHaveText(['No', 'Waktu', 'Nama Item', 'Jenis', 'Divisi', 'Jumlah', 'Referensi']);

  const rows = page.getByRole('table').locator('tbody tr');
  await expect(rows).toHaveCount(3);
  // Urut terbaru: mutasi 27 Juli di baris pertama
  await expect(rows.first()).toContainText('27/07/2026');
  await expect(rows.first()).toContainText('+10');
  // Keluar ditandai minus
  await expect(rows.nth(1)).toContainText('-5');

  await page.getByRole('button', { name: 'Bahan Baku', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Eva Foam Sheet 2cm Raw');

  await page.getByRole('button', { name: 'Barang Jadi', exact: true }).click();
  await expect(rows).toHaveCount(2);
});

test('Riwayat Mutasi bisa difilter per divisi', async ({ page }) => {
  await seed(page);
  await bukaRiwayatMutasi(page);
  const rows = page.getByRole('table').locator('tbody tr');

  await page.getByRole('button', { name: 'Eva Foam', exact: true }).click();
  // m1 berdivisi Eva Foam; m3 belum punya divisi (data lama) jadi tetap ikut tampil
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Eva Foam');

  await page.getByRole('button', { name: 'Konveksi', exact: true }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Konveksi');
});

test('Pengaturan Alur bisa difilter per divisi', async ({ page }) => {
  await isolateAsOwner(page);
  await page.goto('/');
  await page.locator('#nav-tab-produksi').click();
  await page.getByRole('button', { name: 'Pengaturan Alur' }).click();

  const rows = page.getByRole('table').locator('tbody tr');
  const semua = await rows.count();
  expect(semua).toBeGreaterThan(1);

  await page.getByRole('button', { name: 'Eva Foam', exact: true }).click();
  const eva = await rows.count();
  await expect(rows.first().locator('td').nth(1)).toContainText('Eva Foam');

  await page.getByRole('button', { name: 'Konveksi', exact: true }).click();
  const konveksi = await rows.count();
  await expect(rows.first().locator('td').nth(1)).toContainText('Konveksi');

  // Kedua divisi berjumlah sama dengan daftar penuh (produk selalu punya satu divisi)
  expect(eva + konveksi).toBe(semua);

  // Pencarian dan filter divisi bekerja bersamaan
  await page.getByPlaceholder('Cari produk...').fill('zzz-tidak-ada');
  await expect(page.getByText('Tidak ada produk yang cocok')).toBeVisible();
});
