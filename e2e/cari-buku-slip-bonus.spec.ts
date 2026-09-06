import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

// Pencarian nama karyawan kini juga menyaring Buku Slip Bonus (tab Bonus
// Kehadiran > Buku Slip Bonus) — dulu input pencariannya menggantung: hanya
// tabel Posisi & Evaluasi yang ikut tersaring, tabel slip mengabaikannya.
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

const slipTable = (page: Page) => page.locator('table', { has: page.getByRole('button', { name: 'Jumlah (IDR)' }) });

test('buku slip bonus ikut tersaring nama: satu input untuk ketiga tabel', async ({ page }) => {
  await seed(page);
  await bukaBukuSlip(page);

  const input = page.getByPlaceholder('Cari nama karyawan...').first();
  await expect(input).toBeVisible();

  // Sebelum mengetik: dua slip (Siti cair + Dewi gugur).
  const namaBaris = slipTable(page).locator('tbody tr td:first-child');
  await expect(namaBaris).toHaveCount(2);

  // Ketik sebagian nama: hanya Dewi yang tersisa, pesan kosong tidak muncul.
  await input.fill('dewi');
  await expect(namaBaris).toHaveText([/Dewi Lestari/]);

  // Hapus isi input: semua baris kembali.
  await input.fill('');
  await expect(namaBaris).toHaveCount(2);

  // Nama tak dikenal: pesan kosong menyebut pencarian, bukan "belum ada slip".
  // (pesan sama muncul di baris info header & paragraf kosong — ambil paragrafnya)
  await input.fill('zaskia');
  await expect(page.getByRole('paragraph').filter({ hasText: 'Tidak ada slip bonus yang cocok dengan pencarian/filter.' })).toBeVisible();
});
