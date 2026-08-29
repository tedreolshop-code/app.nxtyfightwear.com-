import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Penjaga: pernah terjadi karyawan sudah absen tapi hilang dari "Rekap Per
 * Karyawan" karena admin menghapus akunnya — rekap dulu hanya mengiterasi
 * karyawan aktif, jadi log dengan employee_id tanpa akun ikut lenyap.
 * Dialog hapus menjanjikan "riwayat absensi lama tetap tersimpan", jadi rekap
 * wajib tetap menampilkannya (ditandai Resign/Dihapus).
 */
test('absensi karyawan yang sudah dihapus tetap muncul di Rekap Per Karyawan', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const base = {
      department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
    };
    // Hanya owner yang punya akun. "emp-hantu" tidak ada di daftar karyawan.
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', access_role: 'owner' },
    ]));
    localStorage.setItem('nxty_attendance', JSON.stringify([
      {
        id: `att-emp-hantu-${today}-masuk`, employee_id: 'emp-hantu', employee_name: 'Naufal Hantu',
        timestamp: `${today}T07:50:00+07:00`, type_scan: 'masuk', latitude: 0, longitude: 0,
        distance_meters: 0, selfie_url: '', device_token: 'x', is_mock_location_flag: false,
        status: 'normal', late_minutes: 0,
      },
      {
        id: `att-emp-hantu-${today}-pulang`, employee_id: 'emp-hantu', employee_name: 'Naufal Hantu',
        timestamp: `${today}T16:10:00+07:00`, type_scan: 'pulang', latitude: 0, longitude: 0,
        distance_meters: 0, selfie_url: '', device_token: 'x', is_mock_location_flag: false,
        status: 'normal', late_minutes: 0,
      },
    ]));
  });

  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Absensi', exact: true }).nth(1).click();
  await page.getByRole('button', { name: 'Riwayat & Pemantauan' }).click();
  await page.getByRole('button', { name: 'Rekap Karyawan', exact: true }).click();

  const row = page.locator('tr', { hasText: 'Naufal Hantu' });
  await expect(row).toBeVisible();
  await expect(row.getByText('Resign/Dihapus')).toBeVisible();
  await expect(row.getByRole('cell', { name: '1', exact: true }).first()).toBeVisible(); // hadir = 1
});
