import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Riwayat Keputusan bisa dibatalkan (pengajuan balik menunggu), dan Generate
 * Semua memperingatkan bila ada pengajuan yang belum di-ACC di periode itu.
 */
test('batalkan keputusan mengembalikan ke pending; Generate Semua memperingatkan pengajuan belum di-ACC', async ({ page }) => {
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

  // Setujui
  await page.getByLabel('Lembur disetujui (menit)').fill('60');
  await page.getByRole('button', { name: 'Simpan Keputusan' }).click();
  await expect(page.getByText('lembur 60m')).toBeVisible();

  // Batalkan → pengajuan balik ke "Perlu Diputuskan"
  await page.getByRole('button', { name: 'Batalkan' }).click();
  await expect(page.getByText('bantu bongkar muat')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simpan Keputusan' })).toBeVisible();

  // Generate Semua memperingatkan pengajuan belum di-ACC (periode 15-21 Agustus)
  await page.getByRole('button', { name: 'Buku Register Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Generate Semua' }).click();
  await page.getByLabel('Awal periode generate massal').fill('2026-08-15');
  await page.getByLabel('Akhir periode generate massal').fill('2026-08-21');
  await expect(page.getByText(/1 pengajuan lembur \/ Live TikTok belum di-ACC/)).toBeVisible();
  await expect(page.getByText('⚠ 1 pengajuan belum di-ACC')).toBeVisible();
});
