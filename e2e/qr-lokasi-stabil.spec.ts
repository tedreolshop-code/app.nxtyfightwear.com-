import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1366, height: 1000 }, isMobile: false, hasTouch: false });

/**
 * QR lokasi absensi harus SAMA di semua perangkat.
 *
 * Regresi 29 Sep 2026: token QR lokasi diacak per muat/perangkat, sehingga QR yang
 * dicetak admin tidak cocok di HP karyawan — scan lokasi selalu ditolak "QR lokasi
 * tidak valid", dan absen portal tidak bisa lanjut. Token bawaan kini deterministik
 * dan getWorkSettings() tidak menulis saat dibaca.
 */
const bukaQr = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.locator('button:text-is("Absensi")').last().click();
  await page.getByRole('button', { name: /Jam Kerja & QR Lokasi/i }).click();
  await expect(page.locator('.location-qr-print-card svg')).toBeVisible();
};

const qrHtml = (page: Page) => page.evaluate(() =>
  document.querySelector('.location-qr-print-card svg')?.outerHTML || '');

test('token QR lokasi sama antar-perangkat dan tidak berubah saat halaman dibuka ulang', async ({ page, browser }) => {
  await isolateAsOwner(page);

  await bukaQr(page);
  const qrPertama = await qrHtml(page);
  expect(qrPertama, 'QR lokasi harus tergambar').not.toBe('');

  // Muat ulang di perangkat yang sama → QR tidak boleh berubah.
  await bukaQr(page);
  expect(await qrHtml(page)).toBe(qrPertama);

  // Perangkat karyawan (cache kosong) → QR harus SAMA dengan yang dicetak admin.
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 1000 }, isMobile: false, hasTouch: false });
  const perangkatKaryawan = await ctx.newPage();
  try {
    await isolateAsOwner(perangkatKaryawan);
    await bukaQr(perangkatKaryawan);
    expect(await qrHtml(perangkatKaryawan), 'QR admin harus berlaku di perangkat karyawan').toBe(qrPertama);
  } finally {
    await ctx.close();
  }
});
