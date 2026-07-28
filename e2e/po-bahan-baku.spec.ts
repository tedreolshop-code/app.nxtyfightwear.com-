import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_raw_materials', JSON.stringify([
      { id: 'mat-eva', name: 'Eva Foam Sheet 2cm', department_id: 'dept-eva-foam', unit: 'Lembar', stock_minimum: 10, current_stock: 100 },
      { id: 'mat-kain', name: 'Kain Nylon', department_id: 'dept-konveksi', unit: 'Meter', stock_minimum: 10, current_stock: 50 },
    ]));
    localStorage.setItem('nxty_purchases', JSON.stringify([]));
  });
};

const stok = (page: Page, id: string) => page.evaluate((matId) => {
  const materials = JSON.parse(localStorage.getItem('nxty_raw_materials') || '[]');
  return materials.find((m: any) => m.id === matId)?.current_stock;
}, id);

test('PO yang tertaut bahan baku menambah stok gudang dan mewarisi divisinya', async ({ page }) => {
  await seed(page);
  page.on('dialog', d => d.accept());
  await page.goto('/');
  await page.locator('#nav-tab-pembelian').click();

  expect(await stok(page, 'mat-eva')).toBe(100);

  await page.getByRole('button', { name: 'Terbitkan PO Baru' }).click();
  await page.getByPlaceholder(/Toko anyar/i).fill('Toko Uji');

  // Pilih bahan baku dari gudang → deskripsi terisi sendiri
  await page.locator('select').filter({ hasText: 'Pilih bahan baku' }).selectOption('mat-eva');
  await page.locator('input[type=number]').first().fill('5');
  const hargaInput = page.locator('input[type=number]').nth(1);
  await hargaInput.fill('50000');
  await page.getByRole('button', { name: /Sisipkan Barang ke Draft PO/i }).click();

  // Baris draft menandai bahwa stok akan bertambah, dan divisinya ikut bahan
  await expect(page.getByText(/\+ stok Eva Foam/i)).toBeVisible();

  await page.getByRole('button', { name: 'Posting & Terbitkan PO' }).click();

  // Stok gudang bertambah 5 lembar
  await expect.poll(() => stok(page, 'mat-eva')).toBe(105);

  // Mutasi tercatat memakai nama bahan, bukan deskripsi PO
  const mutasi = await page.evaluate(() => JSON.parse(localStorage.getItem('nxty_stock_movements') || '[]'));
  expect(mutasi[0].item_name).toBe('Eva Foam Sheet 2cm');
  expect(mutasi[0].department_id).toBe('dept-eva-foam');
  expect(mutasi[0].type).toBe('bahan_masuk');
});

test('baris PO wajib memilih bahan baku atau tegas bukan bahan baku', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#nav-tab-pembelian').click();
  await page.getByRole('button', { name: 'Terbitkan PO Baru' }).click();

  await page.locator('input[type=number]').first().fill('2');
  await page.locator('input[type=number]').nth(1).fill('10000');
  await page.locator('input[placeholder*="Liverpool"]').fill('Barang tanpa pilihan');

  await page.getByRole('button', { name: /Sisipkan Barang ke Draft PO/i }).click();

  // App mengganti window.alert dengan toast di dalam layar, jadi pesannya dicek di sana
  await expect(page.getByText(/Pilih bahan baku dari gudang/i)).toBeVisible();
  // Barisnya ditolak, draft tetap kosong
  await expect(page.getByText('DAFTAR ITEM DRAFT PO (0)')).toBeVisible();
});
