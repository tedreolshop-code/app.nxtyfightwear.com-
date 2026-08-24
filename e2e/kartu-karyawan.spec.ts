import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test('kartu karyawan berisi data yang benar dan ikut filter daftar', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = {
      role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
    };
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', department_id: 'dept-eva-foam', access_role: 'owner',
        employee_number: 'AR-EVAFOAM-001', join_date: '2026-07-01', attendance_qr_token: 'token-owner' },
      { ...base, id: 'emp-a', username: 'ani', name: 'Ani Konveksi', department_id: 'dept-konveksi',
        employee_number: 'AR-KONVEKSI-001', join_date: '2026-08-18', attendance_qr_token: 'token-ani' },
    ]));
    localStorage.setItem('nxty_attendance', JSON.stringify([]));
  });
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();

  const kartu = page.locator('#kartu-karyawan-cetak .kartu');
  await expect(kartu).toHaveCount(2);

  // Isi kartu: nama, nomor induk, divisi, tanggal masuk, dan QR token yang sudah ada
  const ani = kartu.filter({ hasText: 'Ani Konveksi' });
  await expect(ani).toContainText('AR-KONVEKSI-001');
  await expect(ani).toContainText('Konveksi');
  await expect(ani).toContainText('Masuk: 2026-08-18');
  await expect(ani.locator('svg')).toHaveCount(1);

  // Tombol menyebut jumlah yang akan tercetak, dan ikut filter daftar
  await expect(page.getByRole('button', { name: 'Cetak Kartu (2)' })).toBeVisible();
  await page.getByPlaceholder(/Cari nama/i).fill('Ani');
  await expect(kartu).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Cetak Kartu (1)' })).toBeVisible();
});

test('dokumen cetak memakai ukuran KTP di kertas A4', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_employees', JSON.stringify([{
      id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', department_id: 'dept-eva-foam',
      role: 'karyawan', rate_harian: 1, rate_lembur_per_jam: 1, status_aktif: true, phone_number: '08',
      pin: 'x', pin_hashed: false, access_role: 'owner', employee_number: 'AR-EVAFOAM-001',
      attendance_qr_token: 'token-owner',
    }]));
  });
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();

  await page.getByRole('button', { name: /Cetak Kartu/ }).click();

  const isi = await page.evaluate(() => {
    const frame = document.querySelector('iframe[aria-hidden="true"]') as HTMLIFrameElement | null;
    const doc = frame?.contentWindow?.document;
    return {
      style: doc?.querySelector('style')?.textContent || '',
      jumlahKartu: doc?.querySelectorAll('.kartu').length ?? 0,
      adaQr: (doc?.querySelectorAll('.kartu svg').length ?? 0) > 0,
    };
  });
  expect(isi.style).toContain('size: A4');
  expect(isi.style).toContain('85.6mm');
  expect(isi.style).toContain('54mm');
  expect(isi.jumlahKartu).toBe(1);
  expect(isi.adaQr).toBe(true);
});
