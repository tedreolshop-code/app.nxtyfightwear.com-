import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Penjaga regresi layar kosong: pernah terjadi seluruh halaman Absensi gagal
 * render (new Map() tertimpa ikon Map dari lucide) dan tidak ada satu pun tes
 * yang menangkapnya — karyawan sepabrik tidak bisa absen sampai keluhan masuk.
 * Tes ini gagal bila halaman Absensi melempar error runtime lagi.
 */
test('halaman Absensi dan tab Koreksi render tanpa error runtime', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = {
      department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
    };
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', access_role: 'owner' },
      { ...base, id: 'emp-uji', username: 'uji', name: 'Budi Uji' },
    ]));
    // Budi masuk kemarin tanpa scan pulang → wajib muncul di daftar koreksi
    const kemarin = new Date(Date.now() + 7 * 3600 * 1000 - 86400000).toISOString().slice(0, 10);
    localStorage.setItem('nxty_attendance', JSON.stringify([{
      id: `att-emp-uji-${kemarin}-masuk`, employee_id: 'emp-uji', employee_name: 'Budi Uji',
      timestamp: `${kemarin}T07:50:00+07:00`, type_scan: 'masuk', latitude: 0, longitude: 0,
      distance_meters: 0, selfie_url: '', device_token: 'x', is_mock_location_flag: false,
      status: 'normal', late_minutes: 0,
    }]));
    localStorage.setItem('nxty_attendance_failures', JSON.stringify([{
      id: 'fail-emp-uji-1', employee_id: 'emp-uji', employee_name: 'Budi Uji',
      timestamp: `${kemarin}T07:49:00+07:00`, type_scan: 'masuk', stage: 'gps',
      reason: 'Akses lokasi ditolak.',
    }]));
  });

  // Portal absensi (kiosk)
  await page.goto('/');
  await page.locator('#nav-tab-absensi').click();
  await expect(page.getByText('Sistem Absensi Karyawan')).toBeVisible();

  // Dashboard admin → tab Koreksi
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Absensi', exact: true }).nth(1).click();
  await page.getByRole('button', { name: 'Riwayat & Pemantauan' }).click();
  await page.getByRole('button', { name: 'Koreksi', exact: true }).click();

  // Scan pulang yang terlewat terdaftar, dan kegagalan scan meninggalkan jejak
  await expect(page.getByText('Scan Pulang Terlewat')).toBeVisible();
  await expect(page.getByText('Budi Uji').first()).toBeVisible();
  await expect(page.getByText('Scan Gagal (7 Hari Terakhir)')).toBeVisible();
  await expect(page.getByText('Akses lokasi ditolak.')).toBeVisible();

  expect(errors).toEqual([]);
});
