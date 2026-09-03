import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

/**
 * Aturan: karyawan mengajukan lembur ATAU Live TikTok, tidak dua-duanya.
 * Kalau yang diajukan Live TikTok, tombol "ACC Lembur" di ACC cepat (modal
 * Generate) tidak muncul — walau sistem sempat menghitung menit lembur dari
 * jam pulang.
 */
test('pengajuan Live TikTok tidak memunculkan tombol ACC Lembur di ACC cepat', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = {
      department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 12000,
      default_live_tiktok_bonus: 25000, default_weekly_cash_advance_deduction: 0,
      status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
    };
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'Ari Owner', access_role: 'owner' },
      { ...base, id: 'emp-live', username: 'lina', name: 'Lina Live' },
      { ...base, id: 'emp-ot', username: 'oki', name: 'Oki Lembur' },
    ]));
    const scan = (emp: string, name: string, date: string, jam: string, type: 'masuk' | 'pulang', extra: object = {}) => ({
      id: `att-${emp}-${date}-${type}`, employee_id: emp, employee_name: name,
      timestamp: `${date}T${jam}:00+07:00`, type_scan: type, latitude: 0, longitude: 0,
      distance_meters: 0, selfie_url: '', device_token: 'x', is_mock_location_flag: false,
      status: 'normal', late_minutes: 0, ...extra,
    });
    localStorage.setItem('nxty_attendance', JSON.stringify([
      scan('emp-live', 'Lina Live', '2026-08-19', '07:50', 'masuk'),
      scan('emp-live', 'Lina Live', '2026-08-19', '19:30', 'pulang', {
        overtime_minutes: 210,
        live_tiktok_request: { reason: 'live jam 17 sampai 19', requested_at: '2026-08-19T19:30:00+07:00' },
      }),
      scan('emp-ot', 'Oki Lembur', '2026-08-19', '07:50', 'masuk'),
      scan('emp-ot', 'Oki Lembur', '2026-08-19', '18:00', 'pulang', {
        overtime_minutes: 120,
        overtime_request: { reason: 'bantu packing', requested_at: '2026-08-19T18:00:00+07:00' },
      }),
    ]));
  });

  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Buku Register Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Generate Satuan' }).click();
  await page.getByLabel('Awal periode generate satuan').fill('2026-08-15');
  await page.getByLabel('Akhir periode generate satuan').fill('2026-08-21');

  // Lina (Live TikTok): ada "ACC Live TikTok", TIDAK ada "ACC Lembur"
  await page.locator('select').first().selectOption({ label: 'Lina Live' });
  await expect(page.getByText(/pengajuan \/ lembur belum di-ACC/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'ACC Live TikTok' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ACC Lembur' })).toHaveCount(0);

  // Oki (lembur): sebaliknya — ada "ACC Lembur", tidak ada "ACC Live TikTok"
  await page.locator('select').first().selectOption({ label: 'Oki Lembur' });
  await expect(page.getByRole('button', { name: 'ACC Lembur' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ACC Live TikTok' })).toHaveCount(0);
});
