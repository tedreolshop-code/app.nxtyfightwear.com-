import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Dulu keputusan pengajuan hanya bisa dibatalkan lalu diinput ulang. Sekarang ada
 * tombol "Ubah" yang memperbarui baris riwayat yang sama — tanpa menambah baris baru
 * dan tanpa harus kehilangan keputusan yang sudah ada.
 */
test('Ubah keputusan memperbarui riwayat, bukan menambah baris baru', async ({ page }) => {
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
      { ...base, id: 'emp-a', username: 'ayu', name: 'Ayu Lembur' },
    ]));
    const scan = (jam: string, type: 'masuk' | 'pulang', extra: object = {}) => ({
      id: `att-emp-a-2026-08-19-${type}`, employee_id: 'emp-a', employee_name: 'Ayu Lembur',
      timestamp: `2026-08-19T${jam}:00+07:00`, type_scan: type, latitude: 0, longitude: 0,
      distance_meters: 0, selfie_url: '', device_token: 'x', is_mock_location_flag: false,
      status: 'normal', late_minutes: 0, ...extra,
    });
    localStorage.setItem('nxty_attendance', JSON.stringify([
      scan('07:50', 'masuk'),
      scan('16:10', 'pulang', { overtime_request: { reason: 'bantu bongkar muat', requested_at: '2026-08-19T16:10:00+07:00' } }),
    ]));
  });

  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: /Perlu Review/ }).click();

  // Putuskan dulu dengan 60 menit
  await page.getByLabel('Lembur disetujui (menit)').fill('60');
  await page.getByRole('button', { name: 'Simpan Keputusan' }).click();
  await expect(page.getByText('lembur 60m')).toBeVisible();

  // Lalu ubah jadi 90 menit tanpa membatalkan keputusan
  await page.getByRole('button', { name: 'Ubah', exact: true }).click();
  await expect(page.getByText('Ubah Keputusan')).toBeVisible();
  await page.getByLabel('Ubah lembur disetujui (menit)').fill('90');
  await page.getByRole('button', { name: 'Simpan Perubahan' }).click();

  await expect(page.getByText('lembur 90m')).toBeVisible();
  await expect(page.getByText('lembur 60m')).toHaveCount(0);

  // Tetap SATU keputusan — bukan baris baru.
  const jumlah = await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('nxty_attendance_adjustments') || '[]') as Array<Record<string, unknown>>;
    return rows.length;
  });
  expect(jumlah).toBe(1);
});
