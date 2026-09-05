import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// Verifikasi sortir tabel Daftar Slip Gaji (klik header kolom). File ini
// sengaja tempelan untuk uji cepat fitur; boleh dihapus atau dilebur ke
// spec lain bila rangkaian gaji sudah punya rumah bersama.
const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_employees', JSON.stringify([
      { id: 'emp-owner', username: 'ari', name: 'Ari Owner', access_role: 'owner', department_id: 'dept-eva-foam',
        role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, status_aktif: true,
        phone_number: '08', pin: 'x', pin_hashed: false },
      { id: 'emp-c', username: 'cici', name: 'Cici Kerja', department_id: 'dept-konveksi',
        role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, status_aktif: true,
        phone_number: '08', pin: 'x', pin_hashed: false },
      { id: 'emp-a', username: 'ana', name: 'Ana Kerja', department_id: 'dept-konveksi',
        role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, status_aktif: true,
        phone_number: '08', pin: 'x', pin_hashed: false },
      { id: 'emp-b', username: 'budi', name: 'Budi Kerja', department_id: 'dept-konveksi',
        role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, status_aktif: true,
        phone_number: '08', pin: 'x', pin_hashed: false },
    ]));

    const slip = (id: string, empId: string, name: string, mulai: string, akhir: string, hari: number, lembur: number, total: number) => ({
      id, employee_id: empId, employee_name: name, period_start: mulai, period_end: akhir,
      days_worked: hari, overtime_hours: lembur, base_pay: total, bonus: 0, cash_advance_deduction: 0,
      total_pay: total, is_printed: false, payment_status: 'unpaid',
    });

    localStorage.setItem('nxty_payroll_weekly', JSON.stringify([
      slip('s1', 'emp-c', 'Cici Kerja', '2026-06-01', '2026-06-05', 3, 0, 300_000),
      slip('s2', 'emp-a', 'Ana Kerja', '2026-06-08', '2026-06-12', 5, 2, 520_000),
      slip('s3', 'emp-b', 'Budi Kerja', '2026-06-15', '2026-06-19', 5, 0, 500_000),
      slip('s4', 'emp-c', 'Cici Kerja', '2026-06-22', '2026-06-26', 4, 1, 410_000),
    ]));
  });
};

const bukaGaji = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
};

const namaBaris = (page: Page) => page.locator('tbody tr td:first-child').allInnerTexts();

test('sortir tabel slip: nama, periode, hari/lembur, total — klik header balik arah', async ({ page }) => {
  await seed(page);
  await bukaGaji(page);

  // Default: nama A-Z
  expect(await namaBaris(page)).toEqual(['Ana Kerja', 'Budi Kerja', 'Cici Kerja', 'Cici Kerja']);

  // Klik Nama Karyawan: balik ke Z-A
  await page.getByRole('button', { name: 'Nama Karyawan' }).click();
  expect(await namaBaris(page)).toEqual(['Cici Kerja', 'Cici Kerja', 'Budi Kerja', 'Ana Kerja']);

  // Klik Total Bersih: terbesar dulu
  await page.getByRole('button', { name: 'Total Bersih (IDR)' }).click();
  const total = page.locator('tbody tr td:nth-child(5)');
  const totalVals = (await total.allInnerTexts()).map(t => Number(t.replace(/[^\d]/g, '')));
  expect(totalVals).toEqual([520_000, 500_000, 410_000, 300_000]);

  // Klik lagi: balik ke terkecil dulu
  await page.getByRole('button', { name: 'Total Bersih (IDR)' }).click();
  const totalVals2 = (await page.locator('tbody tr td:nth-child(5)').allInnerTexts()).map(t => Number(t.replace(/[^\d]/g, '')));
  expect(totalVals2).toEqual([300_000, 410_000, 500_000, 520_000]);

  // Klik Periode Kerja: terbaru dulu
  await page.getByRole('button', { name: 'Periode Kerja' }).click();
  const periode = await page.locator('tbody tr td:nth-child(2)').allInnerTexts();
  expect(periode[0]).toContain('2026-06-22');
  expect(periode[3]).toContain('2026-06-01');

  // Klik Hari / Lembur: hari terbanyak dulu (lembur sebagai pemecah seri)
  await page.getByRole('button', { name: 'Hari / Lembur' }).click();
  const hari = (await page.locator('tbody tr td:nth-child(3)').allInnerTexts()).map(t => Number(t.match(/(\d+) Hari/)![1]));
  expect(hari).toEqual([5, 5, 4, 3]);
});
