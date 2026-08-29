import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Fitur tambahan: generate slip gaji mingguan untuk SEMUA karyawan aktif
 * sekaligus, di samping generate satuan yang lama. Angka dihitung otomatis dari
 * absensi + ACC, masih bisa dikoreksi per baris, dan yang sudah punya slip
 * periode itu dilewati.
 */
test('Generate Semua membuat slip untuk semua karyawan aktif yang punya kehadiran', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = {
      department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      default_weekly_cash_advance_deduction: 0, status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
    };
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'Ari Owner', access_role: 'owner' },
      { ...base, id: 'emp-a', username: 'ayu', name: 'Ayu Kerja' },
      { ...base, id: 'emp-b', username: 'budi', name: 'Budi Kerja' },
      { ...base, id: 'emp-c', username: 'citra', name: 'Citra Kosong' },
    ]));

    const scan = (empId: string, name: string, date: string, jam: string, type: 'masuk' | 'pulang') => ({
      id: `att-${empId}-${date}-${type}`, employee_id: empId, employee_name: name,
      timestamp: `${date}T${jam}:00+07:00`, type_scan: type, latitude: 0, longitude: 0,
      distance_meters: 0, selfie_url: '', device_token: 'x', is_mock_location_flag: false,
      status: 'normal', late_minutes: 0,
    });
    const hariPenuh = (empId: string, name: string, date: string) =>
      [scan(empId, name, date, '07:50', 'masuk'), scan(empId, name, date, '16:10', 'pulang')];

    localStorage.setItem('nxty_attendance', JSON.stringify([
      // Ayu: 3 hari penuh dalam periode 15-21 Agustus
      ...hariPenuh('emp-a', 'Ayu Kerja', '2026-08-17'),
      ...hariPenuh('emp-a', 'Ayu Kerja', '2026-08-18'),
      ...hariPenuh('emp-a', 'Ayu Kerja', '2026-08-19'),
      // Budi: 2 hari penuh
      ...hariPenuh('emp-b', 'Budi Kerja', '2026-08-17'),
      ...hariPenuh('emp-b', 'Budi Kerja', '2026-08-18'),
      // Citra: tidak ada kehadiran
    ]));
  });

  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();

  await page.getByRole('button', { name: 'Generate Semua' }).click();

  // Setel periode ke rentang tetap 15-21 Agustus 2026
  await page.getByLabel('Awal periode generate massal').fill('2026-08-15');
  await page.getByLabel('Akhir periode generate massal').fill('2026-08-21');

  const rowAyu = page.locator('tr', { hasText: 'Ayu Kerja' });
  const rowCitra = page.locator('tr', { hasText: 'Citra Kosong' });

  // Ayu: 3 hari × 100.000 = 300.000, tercentang
  await expect(rowAyu).toContainText('300.000');
  await expect(rowAyu.locator('input[type="checkbox"]')).toBeChecked();
  // Citra tanpa kehadiran: ditandai 0 hari & tidak tercentang
  await expect(rowCitra).toContainText('0 hari');
  await expect(rowCitra.locator('input[type="checkbox"]')).not.toBeChecked();

  // Ayu + Budi terpilih
  await expect(page.getByText('2 slip dipilih')).toBeVisible();

  await page.getByRole('button', { name: /Posting 2 Slip/ }).click();

  // Dua slip baru masuk daftar "Belum Dibayar"
  await expect(page.getByRole('button', { name: /Belum Dibayar\s*2/ })).toBeVisible();
  await expect(page.getByText('2026-08-15').first()).toBeVisible();

  // Generate satuan masih ada
  await expect(page.getByRole('button', { name: 'Generate Satuan' })).toBeVisible();
});
