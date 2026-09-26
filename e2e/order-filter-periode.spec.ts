import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Filter periode tanggal di tab Order Non-Marketplace (paritas dengan Penjualan
 * Marketplace): bawaan bulan berjalan, kartu ringkasan (Total Tagihan / Sudah
 * Bayar / Sisa Tagihan) mengikuti periode dan berlabel jelas, tombol reset
 * menampilkan semua periode.
 */
const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ymPrev = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
    localStorage.setItem('nxty_orders', JSON.stringify([
      // Bulan berjalan: masuk filter bawaan
      { id: 'ord-now', order_number: 'ORD/NOW/001', customer_name: 'Pelanggan Kini', customer_phone: '0812', source: 'offline', date: `${ym}-05`, items: [], total: 330000, dp: 130000, status: 'pending' },
      // Bulan lalu: keluar filter bawaan, muncul lagi setelah reset
      { id: 'ord-prev', order_number: 'ORD/PREV/001', customer_name: 'Pelanggan Lampau', customer_phone: '0813', source: 'offline', date: `${ymPrev}-20`, items: [], total: 100000, dp: 0, status: 'pending' },
    ]));
  });
};

const bukaOrder = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-penjualan').click();
  await page.getByRole('button', { name: 'Order Non-Marketplace' }).click();
};

test('ringkasan & daftar default hanya bulan berjalan, reset menampilkan semua periode', async ({ page }) => {
  await seed(page);
  await bukaOrder(page);

  // Default bulan berjalan: order bulan lalu tersembunyi, ringkasan berlabel periode
  await expect(page.getByRole('table')).toContainText('ORD/NOW/001');
  await expect(page.getByRole('table')).not.toContainText('ORD/PREV/001');
  const kartuTotal = page.locator('div.bg-white', { hasText: 'Total Tagihan' }).first();
  await expect(kartuTotal).toContainText('Rp 330.000');
  await expect(kartuTotal).toContainText('1 order aktif');

  // Reset → semua periode: kedua order tampil, ringkasan menjumlahkan keduanya
  await page.getByTitle('Tampilkan semua periode').click();
  await expect(page.getByRole('table')).toContainText('ORD/PREV/001');
  await expect(kartuTotal).toContainText('Rp 430.000');
  await expect(kartuTotal).toContainText('2 order aktif');
  await expect(kartuTotal).toContainText('Semua periode');
});

test('buku Piutang Pelanggan ikut filter periode dan punya tombol reset', async ({ page }) => {
  await seed(page);
  await bukaOrder(page);

  // Buka sub-tab piutang: default bulan berjalan hanya menampilkan order bulan ini
  await page.getByRole('button', { name: /Piutang Pelanggan/ }).click();
  // Kontainer buku piutang (rounded-xl, ber-heading "Piutang Pelanggan") —
  // daftar pesanan tetap ada di DOM walau ter-hidden, jadi harus dipisah dari situ
  const kartuPiutang = page.locator('div.bg-white.rounded-xl').filter({ has: page.getByRole('heading', { name: 'Piutang Pelanggan' }) });
  const bukuPiutang = kartuPiutang.locator('table');
  await expect(bukuPiutang).toContainText('ORD/NOW/001');
  await expect(bukuPiutang).not.toContainText('ORD/PREV/001');
  await expect(page.getByText('1 tagihan', { exact: true })).toBeVisible();

  // Reset periode (tombol di dalam buku piutang) → piutang bulan lalu ikut muncul
  await kartuPiutang.getByTitle('Tampilkan semua periode').click();
  await expect(bukuPiutang).toContainText('ORD/PREV/001');
  await expect(page.getByText('2 tagihan', { exact: true })).toBeVisible();
});
