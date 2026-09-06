import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

/**
 * Tab Bonus Kehadiran > "Buku Slip Bonus" mengikuti format Gaji Mingguan:
 * tabel datar dengan sortir header + paginasi, kartu ringkasan, toggle
 * Belum Dibayar / Arsip Lunas, pratinjau A4 sebelum cetak, hapus per-slip,
 * dan slip gugur tampil sebagai baris Rp0 + alasannya.
 */

const seed = async (page: Page) => {
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
};

const bukaBukuSlip = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Bonus Kehadiran' }).click();
  await page.getByRole('button', { name: /Buku Slip Bonus/ }).click();
};

// Tabel buku slip berada tepat setelah tombol sortir "Jumlah (IDR)" — pakai
// induk terdekat untuk tidak mengenali tabel slip gaji mingguan di tab lain.
const slipTable = (page: Page) => page.locator('table', { has: page.getByRole('button', { name: 'Jumlah (IDR)' }) });
const namaBaris = async (page: Page) =>
  (await slipTable(page).locator('tbody tr td:first-child').allInnerTexts())
    .map(t => t.replace(/GUGUR$/i, '').trim());

test('Buku Slip Bonus: tabel datar, gugur tampil Rp0 + alasan, sortir header, pratinjau cetak, hapus per-slip', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await seed(page);
  await bukaBukuSlip(page);

  // Kartu ringkasan
  await expect(page.getByText('Total Cair')).toBeVisible();
  await expect(page.getByText('Rp 12.300.000').first()).toBeVisible();   // 6,3jt + 6jt
  await expect(page.getByText('Rp 6.000.000').first()).toBeVisible();    // sudah dibayar
  await expect(page.getByText('Rp 6.300.000').first()).toBeVisible();    // belum dibayar

  // Tabel datar aktif: Juli tampil tanpa klik akordeon, Juni (lunas) tidak.
  // Default sort nama A-Z → Dewi (gugur) di atas Siti.
  await expect(page.getByRole('row', { name: /Siti Rahma.*Juli 2026.*6\.300\.000/ })).toBeVisible();
  const gugur = page.getByRole('row', { name: /Dewi Lestari.*Gugur/ });
  await expect(gugur).toBeVisible();
  await expect(gugur).toContainText('Rp0');          // gugur tetap tampil sebagai baris Rp0
  await expect(gugur).toContainText('Telat 3 hari'); // alasan gugur langsung di tabel
  await expect(page.getByRole('row', { name: /Juni 2026/ })).toHaveCount(0);

  // Detail penilaian: telat net & setengah hari muncul di kolomnya
  await expect(gugur).toContainText('45 mnt');
  await expect(gugur).toContainText('1x');

  // Sortir klik header: Jumlah terbesar dulu → Siti (6,3jt) di atas Dewi (Rp0)
  await page.getByRole('button', { name: 'Jumlah (IDR)' }).click();
  expect(await namaBaris(page)).toEqual(['Siti Rahma', 'Dewi Lestari']);

  // Cetak lewat pratinjau dulu, bukan langsung window.print
  await page.getByRole('button', { name: 'Cetak Slip' }).first().click();
  await expect(page.getByText('Pratinjau Slip Bonus (A4)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cetak Sekarang' })).toBeVisible();
  await page.getByRole('button', { name: 'Tutup' }).click();
  await expect(page.getByText('Pratinjau Slip Bonus (A4)')).toHaveCount(0);

  // Tandai Lunas → pindah ke Arsip Lunas (tabel datar juga)
  await page.getByRole('button', { name: 'Tandai Lunas' }).click();
  await page.getByRole('button', { name: /Arsip Lunas\s*2/ }).click();
  await expect(page.getByRole('row', { name: /Siti Rahma.*Juli 2026.*6\.300\.000/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cetak Ulang' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Batalkan Lunas' }).first()).toBeVisible();

  // Hapus per-slip dengan modal konfirmasi
  await slipTable(page).locator('tbody tr', { hasText: 'Juni 2026' }).getByTitle('Hapus Slip Bonus').click();
  await expect(page.getByText('Hapus Slip Bonus?')).toBeVisible();
  await page.getByRole('button', { name: 'Ya, Hapus' }).click();
  await expect(page.getByRole('row', { name: /Juni 2026/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Arsip Lunas\s*1/ }).click();
});
