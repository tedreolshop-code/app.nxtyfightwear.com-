import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Bug 26 Sep 2026: edit gaji Susanti & Maudi lewat "Edit Slip Gaji" tidak pernah
 * tersimpan. useEffect perhitungan ulang menimpa "Gaji Pokok (Bisa Diubah)" dengan
 * hari kerja × rate profil karyawan setiap field lain (bonus, kasbon, lembur) atau
 * daftar karyawan (sinkron cloud) berubah — jadi angka yang diketik admin hilang
 * sebelum tombol Simpan ditekan.
 *
 * Regresi ini mengetik gaji pokok manual, lalu mengubah field lain. Gaji pokok
 * HARUS tetap angka yang diketik, dan tersimpan apa adanya setelah Simpan.
 */
const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_employees', JSON.stringify([
      { id: 'emp-owner', username: 'ari', name: 'Ari Owner', access_role: 'owner', department_id: 'dept-eva-foam',
        role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, status_aktif: true,
        phone_number: '08', pin: 'x', pin_hashed: false },
      // Tarif profil 60000 = tarif lama Susanti/Maudi yang tidak boleh menimpa edit manual
      { id: 'emp-s', username: 'susan', name: 'Susanti', department_id: 'dept-konveksi',
        role: 'karyawan', rate_harian: 60000, rate_lembur_per_jam: 15000, status_aktif: true,
        phone_number: '08', pin: 'x', pin_hashed: false },
    ]));

    localStorage.setItem('nxty_payroll_weekly', JSON.stringify([
      {
        id: 's1', employee_id: 'emp-s', employee_name: 'Susanti',
        period_start: '2026-09-19', period_end: '2026-09-25',
        days_worked: 6, overtime_hours: 8, base_pay: 360000, bonus: 0,
        cash_advance_deduction: 0, total_pay: 480000, is_printed: false,
        payment_status: 'unpaid',
      },
    ]));
  });
};

const bukaEditSlip = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('main').getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('row', { name: /Susanti/ }).getByRole('button', { name: /Edit/i }).click();
};

test('gaji pokok manual di Edit Slip tidak tertimpa saat field lain berubah', async ({ page }) => {
  await seed(page);
  await bukaEditSlip(page);

  const gajiPokok = page.locator('input[type="number"]').nth(2); // Hari, Lembur, Gaji Pokok, ...
  await expect(gajiPokok).toHaveValue('360000');

  // Admin menaikkan gaji pokok (6 × 100.000 yang diminta karyawan, bukan 6 × 60.000)
  await gajiPokok.fill('600000');

  // Mengubah bonus/kasbon dulu tidak boleh mengembalikan gaji pokok ke 360000
  const bonus = page.locator('input[type="number"]').nth(3);
  await bonus.fill('50000');

  await expect(gajiPokok).toHaveValue('600000');

  // Total THP = 600000 + 8×15000 lembur + 50000 bonus - 0
  const total = page.locator('input[type="number"]').nth(5);
  await expect(total).toHaveValue('770000');

  await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
  page.on('dialog', d => d.accept());

  // Tersimpan di dataStore: base_pay 600000, bukan 360000 hasil timpaan tarif lama
  const tersimpan = await page.evaluate(() => JSON.parse(localStorage.getItem('nxty_payroll_weekly') || '[]')[0]);
  expect(tersimpan.base_pay).toBe(600000);
  expect(tersimpan.total_pay).toBe(770000);
});

test('mengubah hari kerja menghitung ulang gaji pokok dari tarif profil', async ({ page }) => {
  await seed(page);
  await bukaEditSlip(page);

  const hari = page.locator('input[type="number"]').nth(0);
  await hari.fill('5');

  const gajiPokok = page.locator('input[type="number"]').nth(2);
  await expect(gajiPokok).toHaveValue('300000'); // 5 × 60000
});
