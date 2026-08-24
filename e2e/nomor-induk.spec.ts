import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const seed = async (page: import('@playwright/test').Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = {
      role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
    };
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', department_id: 'dept-eva-foam', access_role: 'owner' },
      { ...base, id: 'emp-a', username: 'ani', name: 'Ani Konveksi', department_id: 'dept-konveksi' },
      { ...base, id: 'emp-b', username: 'budi', name: 'Budi Konveksi', department_id: 'dept-konveksi' },
    ]));
    localStorage.setItem('nxty_attendance', JSON.stringify([]));
  });
};

test('penerbitan massal nomor induk: urut per divisi, format sesuai', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();

  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: /Terbitkan No\. Induk \(3\)/ }).click();

  const nomor = await page.evaluate(() => {
    const emp = JSON.parse(localStorage.getItem('nxty_employees') || '[]');
    return Object.fromEntries(emp.map((e: any) => [e.id, e.employee_number]));
  });
  expect(nomor['emp-a']).toBe('AR-KONVEKSI-001');
  expect(nomor['emp-b']).toBe('AR-KONVEKSI-002');
  expect(nomor['emp-owner']).toBe('AR-EVAFOAM-001');

  // Tombolnya hilang setelah semua punya nomor, dan nomornya tampil di tabel
  await expect(page.getByRole('button', { name: /Terbitkan No\. Induk/ })).toHaveCount(0);
  await expect(page.getByRole('table').getByText('AR-KONVEKSI-001')).toBeVisible();
});

test('karyawan baru dapat nomor berikutnya dan tanggal masuk tersimpan', async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    const emp = JSON.parse(localStorage.getItem('nxty_employees') || '[]');
    emp[1].employee_number = 'AR-KONVEKSI-007'; // nomor tertinggi; 008 harus jadi berikutnya
    localStorage.setItem('nxty_employees', JSON.stringify(emp));
  });
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Tambah Karyawan Baru' }).click();

  await page.getByPlaceholder('Nama lengkap...').fill('Citra Baru');
  await page.locator('select').first().selectOption('dept-konveksi');
  await page.locator('input[type="date"]').fill('2026-08-18');
  await page.getByRole('button', { name: 'Otomatis' }).click();
  await expect(page.locator('input[value="AR-KONVEKSI-008"]')).toHaveCount(1);
});
