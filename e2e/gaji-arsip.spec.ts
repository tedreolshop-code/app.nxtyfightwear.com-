import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_employees', JSON.stringify([
      { id: 'emp-owner', username: 'ari', name: 'Ari Owner', access_role: 'owner', department_id: 'dept-eva-foam',
        role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, status_aktif: true,
        phone_number: '08', pin: 'x', pin_hashed: false },
      { id: 'emp-b', username: 'budi', name: 'Budi Kerja', department_id: 'dept-konveksi',
        role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, status_aktif: true,
        phone_number: '08', pin: 'x', pin_hashed: false },
    ]));

    const slip = (id: string, empId: string, mulai: string, akhir: string, status: 'paid' | 'unpaid', total: number) => ({
      id, employee_id: empId, employee_name: empId, period_start: mulai, period_end: akhir,
      days_worked: 6, overtime_hours: 0, base_pay: total, bonus: 0, cash_advance_deduction: 0,
      total_pay: total, is_printed: false, payment_status: status,
      ...(status === 'paid' ? { paid_at: `${akhir}T10:00:00+07:00` } : {}),
    });

    localStorage.setItem('nxty_payroll_weekly', JSON.stringify([
      // Juni: dua periode mingguan, sudah lunas
      slip('s1', 'emp-b', '2026-06-01', '2026-06-07', 'paid', 600_000),
      slip('s2', 'emp-b', '2026-06-08', '2026-06-14', 'paid', 600_000),
      // Juli: satu lunas, satu belum
      slip('s3', 'emp-b', '2026-07-06', '2026-07-12', 'paid', 700_000),
      slip('s4', 'emp-b', '2026-07-13', '2026-07-19', 'unpaid', 800_000),
    ]));
  });
};

const bukaGaji = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
};

test('slip lunas masuk arsip per bulan, yang belum dibayar tetap di daftar aktif', async ({ page }) => {
  await seed(page);
  await bukaGaji(page);

  // Daftar aktif hanya berisi yang belum dibayar (1 slip)
  await expect(page.getByRole('button', { name: /Belum Dibayar\s*1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Arsip Lunas\s*3/ })).toBeVisible();
  await expect(page.getByText('2026-07-13')).toBeVisible();
  await expect(page.getByText('2026-06-01')).toHaveCount(0);

  // Arsip dikelompokkan per bulan periode kerja, terbaru dulu
  await page.getByRole('button', { name: /Arsip Lunas/ }).click();
  // Judul kelompok bulan ada di tombol yang bisa dibuka-tutup
  await expect(page.getByRole('button', { name: /Juli 2026/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Juni 2026/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Juni 2026/ })).toContainText('2 slip');
  await expect(page.getByRole('button', { name: /Juni 2026/ })).toContainText('2 periode mingguan');

  // Buka Juni: periode mingguannya terlihat
  await page.getByRole('button', { name: /Juni 2026/ }).click();
  await expect(page.getByText('2026-06-08 → 2026-06-14')).toBeVisible();
});

test('batalkan lunas mengembalikan slip ke daftar aktif', async ({ page }) => {
  await seed(page);
  page.on('dialog', d => d.accept()); // confirm masih dialog asli
  await bukaGaji(page);

  await page.getByRole('button', { name: /Arsip Lunas/ }).click();
  await page.getByRole('button', { name: /Juli 2026/ }).click();
  await page.getByRole('button', { name: 'Batalkan Lunas' }).first().click();

  // Arsip Juli tinggal kosong, daftar aktif jadi 2 slip
  await expect(page.getByRole('button', { name: /Belum Dibayar\s*2/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Arsip Lunas\s*2/ })).toBeVisible();
});
