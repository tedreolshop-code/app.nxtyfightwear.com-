import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const hariIni = new Date().toISOString().slice(0, 10);

const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript((tgl) => {
    localStorage.setItem('nxty_attendance', JSON.stringify([
      { id: 'a1', employee_id: 'emp-asep', employee_name: 'Asep Saputra', timestamp: `${tgl}T07:55:00.000+07:00`, type_scan: 'masuk', status: 'normal', late_minutes: 5, latitude: 0, longitude: 0, distance_meters: 3, is_mock_location_flag: false },
      { id: 'a2', employee_id: 'emp-asep', employee_name: 'Asep Saputra', timestamp: `${tgl}T17:05:00.000+07:00`, type_scan: 'pulang', status: 'normal', worked_minutes: 550, work_fraction: 1, latitude: 0, longitude: 0, distance_meters: 3, is_mock_location_flag: false },
    ]));
  }, hariIni);
};

test('Riwayat absensi diunduh sebagai file Excel (.xlsx), bukan CSV', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('main').getByRole('button', { name: 'Absensi', exact: true }).click();
  await page.getByRole('main').getByRole('button', { name: /Riwayat/ }).first().click();

  const tombol = page.getByRole('button', { name: 'Excel' }).first();
  await expect(tombol).toBeVisible();

  const [unduhan] = await Promise.all([page.waitForEvent('download'), tombol.click()]);
  expect(unduhan.suggestedFilename()).toMatch(/^Riwayat_Absensi_.*\.xlsx$/);

  // Isi benar-benar workbook xlsx (zip, magic bytes "PK"), bukan teks CSV
  const path = await unduhan.path();
  const fs = await import('fs');
  expect(fs.readFileSync(path!).subarray(0, 2).toString()).toBe('PK');
});
