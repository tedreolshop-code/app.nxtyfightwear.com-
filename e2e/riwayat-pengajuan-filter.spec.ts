import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Tab "Perlu Review" (Perlu Diputuskan + Riwayat Keputusan) bisa disaring per
 * karyawan, dan tombol "Buka Perlu Review" dari modal generate satuan otomatis
 * menyaring ke karyawan yang sedang dipilih. Badge tab tetap hitung total.
 */
test('Perlu Review & Riwayat Keputusan tersaring per karyawan', async ({ page }) => {
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
      { ...base, id: 'emp-a', username: 'ayu', name: 'Ayu Satu' },
      { ...base, id: 'emp-b', username: 'budi', name: 'Budi Dua' },
    ]));
    const scan = (emp: string, nm: string, d: string, jam: string, type: string, extra: object = {}) => ({
      id: `att-${emp}-${d}-${type}`, employee_id: emp, employee_name: nm, timestamp: `${d}T${jam}:00+07:00`,
      type_scan: type, latitude: 0, longitude: 0, distance_meters: 0, selfie_url: '', device_token: 'x',
      is_mock_location_flag: false, status: 'normal', late_minutes: 0, ...extra,
    });
    localStorage.setItem('nxty_attendance', JSON.stringify([
      scan('emp-a', 'Ayu Satu', '2026-08-19', '07:50', 'masuk'),
      scan('emp-a', 'Ayu Satu', '2026-08-19', '16:10', 'pulang', { overtime_request: { reason: 'alasannya-ayu', requested_at: '2026-08-19T16:10:00+07:00' } }),
      scan('emp-b', 'Budi Dua', '2026-08-20', '07:50', 'masuk'),
      scan('emp-b', 'Budi Dua', '2026-08-20', '16:10', 'pulang', { overtime_request: { reason: 'alasannya-budi', requested_at: '2026-08-20T16:10:00+07:00' } }),
    ]));
    localStorage.setItem('nxty_attendance_adjustments', JSON.stringify([
      { id: 'adj-a', attendance_id: 'x-a', employee_id: 'emp-a', employee_name: 'Ayu Satu', date: '2026-08-12',
        checkout_time: '17:30', type: 'overtime', status: 'approved', overtime_minutes: 90, bonus_amount: 0,
        late_compensation_minutes: 0, note: 'catatan-adj-a', approved_by_name: 'Ari', approved_at: '2026-08-13T09:00:00+07:00' },
      { id: 'adj-b', attendance_id: 'x-b', employee_id: 'emp-b', employee_name: 'Budi Dua', date: '2026-08-12',
        checkout_time: '17:00', type: 'overtime', status: 'approved', overtime_minutes: 55, bonus_amount: 0,
        late_compensation_minutes: 0, note: 'catatan-adj-b', approved_by_name: 'Ari', approved_at: '2026-08-13T09:05:00+07:00' },
    ]));
  });

  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: /Perlu Review/ }).click();

  const rowAyuRiwayat = page.getByRole('row', { name: /Ayu Satu.*90m/ });
  const rowBudiRiwayat = page.getByRole('row', { name: /Budi Dua.*55m/ });

  // Tanpa filter: dua-duanya tampil
  await expect(rowAyuRiwayat).toBeVisible();
  await expect(rowBudiRiwayat).toBeVisible();
  await expect(page.getByText('alasannya-ayu')).toBeVisible();
  await expect(page.getByText('alasannya-budi')).toBeVisible();

  // Saring ke Ayu
  await page.getByRole('combobox').first().selectOption({ label: 'Ayu Satu' });
  await expect(rowAyuRiwayat).toBeVisible();
  await expect(rowBudiRiwayat).toHaveCount(0);
  await expect(page.getByText('alasannya-ayu')).toBeVisible();
  await expect(page.getByText('alasannya-budi')).toHaveCount(0);
  // Badge tab tetap hitung total (2)
  await expect(page.getByRole('button', { name: /Perlu Review\s*2/ })).toBeVisible();

  // Dari Generate Satuan: pilih Budi → Buka Perlu Review → tersaring ke Budi
  await page.getByRole('button', { name: 'Buku Register Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Generate Satuan' }).click();
  await page.getByLabel('Awal periode generate satuan').fill('2026-08-15');
  await page.getByLabel('Akhir periode generate satuan').fill('2026-08-21');
  await page.locator('select').first().selectOption({ label: 'Budi Dua' });
  await page.getByRole('button', { name: 'Buka Perlu Review' }).click();

  await expect(page.getByText('alasannya-budi')).toBeVisible();
  await expect(page.getByText('alasannya-ayu')).toHaveCount(0);
  await expect(rowBudiRiwayat).toBeVisible();
  await expect(rowAyuRiwayat).toHaveCount(0);
});
