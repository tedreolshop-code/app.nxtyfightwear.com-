import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// Semua isi seed HARUS berada di dalam fungsi: addInitScript hanya menyalin isi
// fungsinya ke browser, bukan variabel di sekelilingnya.
const seed = (paymentStatus: 'paid' | 'unpaid') => {
  localStorage.setItem('nxty_employees', JSON.stringify([
    { id: 'emp-owner', username: 'ari', name: 'Ari Owner', department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 0, rate_lembur_per_jam: 0, status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false, access_role: 'owner' },
    { id: 'emp-uji', username: 'uji', name: 'Budi Uji', department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, default_attendance_bonus: 20000, status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false },
  ]));
  localStorage.setItem('nxty_attendance', JSON.stringify([]));
  localStorage.setItem('nxty_attendance_bonus_payouts', JSON.stringify([{
    id: 'bonus-2026-07-emp-uji', employee_id: 'emp-uji', employee_name: 'Budi Uji', month: '2026-07',
    amount: 200000, status: 'cair', working_days: 22, present_days: 20, late_minutes_net: 0,
    half_days: 0, qualified_days: 10, daily_rate: 20000, issued_at: '2026-08-01T08:00:00+07:00',
    payment_status: paymentStatus,
  }]));
};

const bukaBukuSlip = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Bonus Kehadiran' }).click();
  await page.getByRole('button', { name: /Buku Slip Bonus/ }).click();
};

/** Slip bonus yang sudah terbit dulu hanya bisa dihapus lalu diterbitkan ulang untuk SEMUA karyawan. */
test('Ubah slip bonus menyimpan nominal baru beserta alasan dan nilai aslinya', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await isolateAsOwner(page);
  await page.addInitScript(seed, 'unpaid');

  await bukaBukuSlip(page);
  await page.getByRole('button', { name: 'Ubah', exact: true }).first().click();
  await expect(page.getByText('Ubah Slip Bonus')).toBeVisible();

  await page.getByLabel('Nominal slip bonus').fill('300000');
  await page.getByLabel('Alasan koreksi slip bonus').fill('Hari layak keliru dihitung');
  await page.getByRole('button', { name: 'Simpan Koreksi' }).click();

  const tersimpan = await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('nxty_attendance_bonus_payouts') || '[]') as Array<Record<string, unknown>>;
    return rows[0] || null;
  });
  expect(tersimpan).not.toBeNull();
  expect(tersimpan!.amount).toBe(300000);
  expect(tersimpan!.original_amount).toBe(200000);
  expect(tersimpan!.edit_reason).toBe('Hari layak keliru dihitung');
  expect(typeof tersimpan!.edited_at).toBe('string');
});

test('slip bonus yang sudah LUNAS menampilkan peringatan sebelum nominal diubah', async ({ page }) => {
  const dialog: string[] = [];
  page.on('dialog', d => { dialog.push(d.message()); d.accept(); });
  await isolateAsOwner(page);
  await page.addInitScript(seed, 'paid');

  await bukaBukuSlip(page);
  // Slip yang sudah lunas pindah ke Arsip Lunas, bukan daftar aktif.
  await page.getByRole('button', { name: 'Arsip Lunas' }).click();
  await page.getByRole('button', { name: 'Ubah', exact: true }).first().click();
  await expect(page.getByText(/sudah ditandai LUNAS/)).toBeVisible();

  await page.getByLabel('Nominal slip bonus').fill('150000');
  await page.getByLabel('Alasan koreksi slip bonus').fill('Kelebihan bayar, dikoreksi');
  await page.getByRole('button', { name: 'Simpan Koreksi' }).click();

  expect(dialog.some(m => m.includes('sudah ditandai LUNAS'))).toBe(true);

  const tersimpan = await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('nxty_attendance_bonus_payouts') || '[]') as Array<Record<string, unknown>>;
    return rows[0] || null;
  });
  expect(tersimpan!.amount).toBe(150000);
});
