import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Bonus kehadiran dibayar terpisah tiap tanggal 1, jadi tidak boleh ikut terisi di
 * slip gaji mingguan. Kalau ikut, karyawan dibayar dua kali untuk hal yang sama.
 */
const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_employees', JSON.stringify([{
      id: 'emp-owner', username: 'ari', name: 'Karyawan A', access_role: 'owner',
      department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      default_attendance_bonus: 10000, default_live_tiktok_bonus: 20000,
      status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false, employment_status: 'karyawan',
    }]));

    // Sepekan penuh masuk tanpa telat dan pulang lewat jam pulang → berhak bonus kehadiran
    const dasar = {
      employee_id: 'emp-owner', employee_name: 'Karyawan A', latitude: 0, longitude: 0,
      distance_meters: 1, selfie_url: '', device_token: 'x', is_mock_location_flag: false,
      status: 'normal', late_minutes: 0, work_fraction: 1,
    };
    const scans: any[] = [];
    for (let d = 20; d <= 25; d++) {
      const tgl = `2026-07-${d}`;
      scans.push({ ...dasar, id: `m${d}`, timestamp: `${tgl}T07:40:00+07:00`, type_scan: 'masuk' });
      scans.push({ ...dasar, id: `p${d}`, timestamp: `${tgl}T16:20:00+07:00`, type_scan: 'pulang' });
    }
    localStorage.setItem('nxty_attendance', JSON.stringify(scans));
    const settings = JSON.parse(localStorage.getItem('nxty_work_settings') || '{}');
    localStorage.setItem('nxty_work_settings', JSON.stringify({
      ...settings, start_time: '08:00', end_time: '16:00', attendance_effective_from: '2026-07-20',
    }));
  });
};

test('bonus kehadiran tidak ikut terisi di slip gaji mingguan', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();

  // Buka modal Profil & Gaji lalu sinkronkan absensi
  await page.getByRole('button', { name: /Profil & Gaji/ }).first().click();
  await page.getByRole('button', { name: /Manajemen Gaji/i }).click();
  await page.getByRole('button', { name: /Ambil Data Absensi/i }).click();

  // Bonus di slip mingguan harus nol: tidak ada bonus kerja (Live TikTok) periode ini,
  // dan bonus kehadiran memang tidak boleh ikut ke sini
  const nilaiBonus = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('label'))
      .find(l => l.textContent?.includes('Bonus Kerja'));
    const input = label?.parentElement?.querySelector('input') as HTMLInputElement | null;
    return input?.value ?? null;
  });
  expect(nilaiBonus).toBe('0');

  // Keterangannya menegaskan bonus kehadiran dibayar terpisah
  await expect(page.getByText(/Bonus kehadiran tidak di sini/)).toBeVisible();
});
