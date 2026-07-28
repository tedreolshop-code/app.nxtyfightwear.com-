import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_raw_materials', JSON.stringify([
      { id: 'mat-eva', name: 'Eva Foam Sheet', department_id: 'dept-eva-foam', unit: 'Lembar', stock_minimum: 5, current_stock: 100 },
      { id: 'mat-kain', name: 'Kain Nylon', department_id: 'dept-konveksi', unit: 'Meter', stock_minimum: 5, current_stock: 50 },
      { id: 'mat-lem', name: 'Lem Serbaguna', unit: 'Kg', stock_minimum: 1, current_stock: 10 }, // Umum
    ]));
    localStorage.setItem('nxty_products', JSON.stringify([
      { id: 'prod-eva', department_id: 'dept-eva-foam', name: 'Matras Eva', category: 'Matras', variant: 'Merah', harga_jual: 100000, stock: 10 },
      { id: 'prod-kon', department_id: 'dept-konveksi', name: 'Samsak Konveksi', category: 'Apparel', variant: 'Hitam', harga_jual: 200000, stock: 5 },
    ]));
  });
};

const bukaOpname = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-gudang').click();
  await page.getByRole('button', { name: /Stock Opname/i }).first().click();
};

const pilihanItem = (page: Page) =>
  page.locator('select').filter({ hasText: '-- Pilih Item --' }).locator('option').allInnerTexts();

// Halaman di belakang modal punya filter divisi sendiri, jadi tombol dibatasi ke form opname
const tombolDivisi = (page: Page, nama: string) =>
  page.locator('form').getByRole('button', { name: nama, exact: true });

test('form Stock Opname punya pemilih divisi sendiri untuk bahan baku', async ({ page }) => {
  await seed(page);
  await bukaOpname(page);

  // Bawaan Semua Divisi: tiga bahan tampil
  expect((await pilihanItem(page)).join(' | ')).toContain('Kain Nylon');

  // Eva Foam: bahan Konveksi hilang, bahan Umum tetap ikut karena dipakai keduanya
  await tombolDivisi(page, 'Eva Foam').click();
  const eva = (await pilihanItem(page)).join(' | ');
  expect(eva).toContain('Eva Foam Sheet');
  expect(eva).toContain('Lem Serbaguna');
  expect(eva).not.toContain('Kain Nylon');

  await tombolDivisi(page, 'Konveksi').click();
  const konveksi = (await pilihanItem(page)).join(' | ');
  expect(konveksi).toContain('Kain Nylon');
  expect(konveksi).not.toContain('Eva Foam Sheet');
});

test('barang jadi di Stock Opname juga terpisah per divisi', async ({ page }) => {
  await seed(page);
  await bukaOpname(page);

  await page.locator('select').filter({ hasText: 'Bahan Baku' }).selectOption('product');
  expect((await pilihanItem(page)).join(' | ')).toContain('Samsak Konveksi');

  await tombolDivisi(page, 'Eva Foam').click();
  const eva = (await pilihanItem(page)).join(' | ');
  expect(eva).toContain('Matras Eva');
  // Dulu daftar barang jadi tidak difilter divisi sama sekali
  expect(eva).not.toContain('Samsak Konveksi');
});

test('opname mencatat divisi item pada mutasi stok', async ({ page }) => {
  await seed(page);
  await bukaOpname(page);

  await tombolDivisi(page, 'Konveksi').click();
  await page.locator('select').filter({ hasText: '-- Pilih Item --' }).selectOption('mat-kain');
  await page.locator('input[type=number]').first().fill('7');
  await page.getByRole('button', { name: /Posting Opname/i }).click();

  await expect.poll(async () => (await page.evaluate(() => {
    const materials = JSON.parse(localStorage.getItem('nxty_raw_materials') || '[]');
    return materials.find((m: any) => m.id === 'mat-kain')?.current_stock;
  }))).toBe(57);

  const mutasi = await page.evaluate(() => JSON.parse(localStorage.getItem('nxty_stock_movements') || '[]'));
  expect(mutasi[0].department_id).toBe('dept-konveksi');
  expect(mutasi[0].type).toBe('bahan_masuk');
});
