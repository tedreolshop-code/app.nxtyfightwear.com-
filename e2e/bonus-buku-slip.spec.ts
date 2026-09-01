import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

/**
 * Tab Bonus Kehadiran > "Buku Slip Bonus" mengikuti format Gaji Mingguan:
 * kartu ringkasan, toggle Belum Dibayar / Arsip Lunas, ekspor Excel, dan
 * slip bonus per karyawan bisa dicetak.
 */
test('Buku Slip Bonus: kartu ringkasan, arsip lunas, cetak slip', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = { department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      default_attendance_bonus: 300000, status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false };
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', access_role: 'owner' },
      { ...base, id: 'emp-a', username: 'siti', name: 'Siti Rahma' },
      { ...base, id: 'emp-b', username: 'dewi', name: 'Dewi Lestari' },
    ]));
    localStorage.setItem('nxty_attendance_bonus_payouts', JSON.stringify([
      { id: 'bonus-2026-07-emp-a', employee_id: 'emp-a', employee_name: 'Siti Rahma', month: '2026-07', amount: 6300000,
        status: 'cair', working_days: 26, present_days: 26, late_minutes_net: 0, half_days: 0,
        issued_at: '2026-08-01T08:00:00+07:00', payment_status: 'unpaid' },
      { id: 'bonus-2026-07-emp-b', employee_id: 'emp-b', employee_name: 'Dewi Lestari', month: '2026-07', amount: 0,
        status: 'gugur', reason: 'Telat 3 hari', working_days: 26, present_days: 24, late_minutes_net: 45, half_days: 1,
        issued_at: '2026-08-01T08:00:00+07:00', payment_status: 'unpaid' },
      { id: 'bonus-2026-06-emp-a', employee_id: 'emp-a', employee_name: 'Siti Rahma', month: '2026-06', amount: 6000000,
        status: 'cair', working_days: 25, present_days: 25, late_minutes_net: 0, half_days: 0,
        issued_at: '2026-07-01T08:00:00+07:00', payment_status: 'paid', paid_at: '2026-07-02T10:00:00+07:00' },
    ]));
  });

  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Bonus Kehadiran' }).click();
  await page.getByRole('button', { name: /Buku Slip Bonus/ }).click();

  // Kartu ringkasan
  await expect(page.getByText('Total Cair')).toBeVisible();
  await expect(page.getByText('Rp 12.300.000').first()).toBeVisible();   // 6,3jt + 6jt
  await expect(page.getByText('Rp 6.000.000').first()).toBeVisible();    // sudah dibayar
  await expect(page.getByText('Rp 6.300.000').first()).toBeVisible();    // belum dibayar

  // Belum Dibayar: Juli tampil, Juni (lunas) tidak
  await page.getByRole('button', { name: /Juli 2026/ }).click();
  await expect(page.getByRole('row', { name: /Siti Rahma.*6.300.000/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Dewi Lestari.*Gugur/i })).toBeVisible();

  // Tandai Lunas → pindah ke Arsip Lunas
  await page.getByRole('button', { name: 'Tandai Lunas' }).click();
  await page.getByRole('button', { name: /Arsip Lunas\s*2/ }).click();
  await page.getByRole('button', { name: /Juli 2026/ }).click();
  await expect(page.getByRole('button', { name: 'Cetak Ulang' }).first()).toBeVisible();
});
