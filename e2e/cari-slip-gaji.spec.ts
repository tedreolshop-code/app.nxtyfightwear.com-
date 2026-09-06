import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// Pencarian karyawan di Buku Register Slip Gaji (tabel bawah tab Gaji Mingguan):
// nama yang diketik menyaring baris tabel, badge jumlah, dan arsip lunas.
const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_employees', JSON.stringify([
      { id: 'emp-owner', username: 'ari', name: 'Ari Owner', access_role: 'owner', department_id: 'dept-eva-foam',
        role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, status_aktif: true,
        phone_number: '08', pin: 'x', pin_hashed: false },
      { id: 'emp-a', username: 'ana', name: 'Ana Kerja', department_id: 'dept-konveksi',
        role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, status_aktif: true,
        phone_number: '08', pin: 'x', pin_hashed: false },
      { id: 'emp-b', username: 'budi', name: 'Budi Kerja', department_id: 'dept-konveksi',
        role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, status_aktif: true,
        phone_number: '08', pin: 'x', pin_hashed: false },
    ]));

    const slip = (id: string, empId: string, name: string, mulai: string, akhir: string, total: number, lunas: boolean) => ({
      id, employee_id: empId, employee_name: name, period_start: mulai, period_end: akhir,
      days_worked: 5, overtime_hours: 0, base_pay: total, bonus: 0, cash_advance_deduction: 0,
      total_pay: total, is_printed: false, payment_status: lunas ? 'paid' : 'unpaid',
    });

    localStorage.setItem('nxty_payroll_weekly', JSON.stringify([
      slip('s1', 'emp-a', 'Ana Kerja', '2026-06-01', '2026-06-05', 300_000, false),
      slip('s2', 'emp-b', 'Budi Kerja', '2026-06-08', '2026-06-12', 500_000, false),
      slip('s3', 'emp-a', 'Ana Kerja', '2026-06-15', '2026-06-19', 350_000, true),
    ]));
  });
};

const bukaGaji = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
};

test('cari karyawan di buku register slip: tabel tersaring, reset mengembalikan semua', async ({ page }) => {
  await seed(page);
  await bukaGaji(page);

  const input = page.getByPlaceholder('Cari nama karyawan...').first();
  await expect(input).toBeVisible();

  // Ketik sebagian nama (huruf kecil): hanya Ana yang tersisa di tabel aktif.
  await input.fill('ana');
  const namaBaris = page.locator('tbody tr td:first-child');
  await expect(namaBaris).toHaveText(['Ana Kerja']);

  // Reset Filter: tombol muncul karena filter aktif, semua baris kembali.
  await page.getByRole('button', { name: 'Reset Filter' }).click();
  await expect(input).toHaveValue('');
  const namaSetelahReset = await page.locator('tbody tr td:first-child').allInnerTexts();
  expect(namaSetelahReset).toContain('Ana Kerja');
  expect(namaSetelahReset).toContain('Budi Kerja');
});

test('pencarian tanpa hasil menampilkan pesan kosong, tidak baris hantu', async ({ page }) => {
  await seed(page);
  await bukaGaji(page);

  const input = page.getByPlaceholder('Cari nama karyawan...').first();
  await input.fill('zaskia');
  await expect(page.getByText('Belum ada slip gaji yang cocok dengan filter atau terdaftar.')).toBeVisible();
  // Satu-satunya baris tersisa adalah pesan kosong, bukan baris slip.
  await expect(page.locator('tbody tr td:first-child')).toHaveText(['Belum ada slip gaji yang cocok dengan filter atau terdaftar.']);
});
