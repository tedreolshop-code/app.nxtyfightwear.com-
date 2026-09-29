import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Antara 00:00–07:00 WIB, new Date().toISOString() masih bertanggal KEMARIN
 * (UTC). Kalau tanggal transaksi diambil dari situ, penjualan pagi tersimpan
 * di tanggal yang salah — di awal bulan malah jatuh ke bulan lalu sehingga
 * langsung hilang dari filter bawaan (menu Penjualan tampak kosong / Rp 0).
 * Tanggalnya harus tetap hari ini menurut WIB.
 */
test('penjualan yang diinput pagi (00:30 WIB) bertanggal hari ini WIB', async ({ page }) => {
  // 2026-09-01 00:30 WIB = 2026-08-31 17:30 UTC → tanggal UTC = 31 Agustus
  await page.clock.install({ time: new Date('2026-09-01T00:30:00+07:00') });
  page.on('dialog', (d) => d.accept());
  await isolateAsOwner(page);

  await page.goto('/');
  await page.locator('#nav-tab-penjualan').click();
  await page.getByRole('button', { name: 'Tambah Penjualan' }).click();

  const tanggal = page.locator('form input[type=date]').first();
  await expect(tanggal).toHaveValue('2026-09-01');

  // Simpan satu barang, lalu pastikan transaksinya benar-benar tampil di tabel
  // (bukan tersembunyi di luar filter bulan berjalan).
  const produk = page.locator('select').filter({ hasText: 'Ketik Deskripsi Custom' });
  const nilai = await produk.locator('option').evaluateAll(
    (os) => os.map((o) => (o as HTMLOptionElement).value).filter((v) => v && v !== 'custom'),
  );
  await produk.selectOption(nilai[0]);
  await page.getByRole('button', { name: 'Tambah', exact: true }).click();
  await page.getByRole('button', { name: 'Simpan & Posting Detail' }).click();

  await expect(page.getByText(/Tersimpan: pesanan/)).toBeVisible();
  await expect(page.getByText('Tidak ada data penjualan untuk diexport!')).toBeHidden();

  const baris = await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('nxty_marketplace_item_sales') || '[]');
    return rows[0]?.date ?? null;
  });
  expect(baris).toBe('2026-09-01');

  // Tabel tidak boleh kosong — nominal harus muncul, bukan Rp 0.
  await expect(page.getByText(/Dari 1 pesanan/)).toBeVisible();
});
