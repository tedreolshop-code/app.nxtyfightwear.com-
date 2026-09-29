import { test, expect } from '@playwright/test';
import { blockCloudSync } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Data produksi (±5 MB) nyaris menyentuh kuota localStorage — di iOS Safari
 * batasnya 5 MB. Dulu `handleLogin` menulis sesi TANPA penjagaan, sehingga
 * QuotaExceededError membuat tombol Masuk tidak bereaksi sama sekali dan
 * aplikasi terasa "tidak bisa dibuka". Login tidak boleh bergantung pada
 * berhasilnya penulisan cache.
 */
test('tombol Masuk tetap membuka aplikasi saat storage penuh', async ({ page }) => {
  await blockCloudSync(page);
  await page.goto('/');
  await page.waitForTimeout(600);

  // Isi sampai tulisan sekecil sesi login (±100 karakter) pun ditolak.
  const ruangSisaUntukSesi = await page.evaluate(() => {
    let n = 0;
    for (const size of [1_000_000, 100_000, 10_000, 1_000, 100, 10, 1]) {
      while (n < 200) {
        try {
          localStorage.setItem(`nxty_filler_${n}`, 'x'.repeat(size));
          n++;
        } catch {
          break;
        }
      }
    }
    const sampel = JSON.stringify({ role: 'owner', name: 'Uji Sesi', employeeId: 'emp-owner' });
    try {
      localStorage.setItem('nxty_cek_ruang', sampel);
      localStorage.removeItem('nxty_cek_ruang');
      return true;
    } catch {
      return false;
    }
  });
  expect(ruangSisaUntukSesi, 'tidak ada lagi ruang untuk menulis sesi login').toBe(false);

  // Login lewat UI memakai akun bawaan (ari / 2026)
  await page.getByPlaceholder('username').fill('ari');
  await page.getByPlaceholder('••••').fill('2026');
  await page.getByRole('button', { name: 'Masuk' }).click();

  // Sidebar muncul = aplikasi benar-benar terbuka, dan form login sudah hilang.
  await expect(page.locator('#nav-tab-dashboard')).toBeVisible();
  await expect(page.getByPlaceholder('username')).toHaveCount(0);
});
