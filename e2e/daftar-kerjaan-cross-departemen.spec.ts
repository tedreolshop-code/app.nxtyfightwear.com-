import { test, expect } from '@playwright/test';
import { blockCloudSync } from './isolate';

test.use({ viewport: { width: 1366, height: 1000 }, isMobile: false, hasTouch: false });

// Regresi: job yang di-assign eksplisit ke pegawai tetap tampil di Daftar Kerjaan Saya
// meski department_id job berbeda dari departemen pegawai saat ini (mis. pegawai pindah
// divisi setelah job dibuat) — sebelumnya job hanya muncul di popup "Ada Kerjaan Baru"
// tapi tidak pernah ada di daftar ("Belum ada kerjaan aktif").
const seed = () => {
  localStorage.setItem('nxty_employees', JSON.stringify([
    { id: 'emp-novi', username: 'novi', name: 'Novi Yulianti', department_id: 'dept-konveksi', role: 'leader', pin: '1234', status_aktif: true, allowed_tabs: ['dashboard', 'produksi', 'absensi', 'gaji', 'profil'] },
  ]));
  localStorage.setItem('nxty_departments', JSON.stringify([
    { id: 'dept-konveksi', name: 'Konveksi' },
    { id: 'dept-eva-foam', name: 'Eva Foam' },
  ]));
  localStorage.setItem('nxty_production_jobs', JSON.stringify([
    {
      id: 'job-cross-1', order_number: 'PROD/2026/0035', department_id: 'dept-eva-foam',
      product_id: 'p1', product_name: 'Deker tangan', variant: '', qty: 2,
      status: 'ongoing', current_stage: 'Potong', created_at: '2026-09-08T08:00:00+07:00',
      stages: [{ stage: 'Potong', status: 'ongoing' }, { stage: 'Jahit', status: 'pending' }],
      assigned_employees: [{ employee_id: 'emp-novi', employee_name: 'Novi Yulianti' }],
    },
    {
      id: 'job-dept-1', order_number: 'PROD/2026/0036', department_id: 'dept-konveksi',
      product_id: 'p2', product_name: 'Body Konveksi', variant: 'M', qty: 5,
      status: 'ongoing', current_stage: 'Potong', created_at: '2026-09-08T09:00:00+07:00',
      stages: [{ stage: 'Potong', status: 'ongoing' }],
      assigned_employees: [],
    },
  ]));
  localStorage.setItem('nxty_session', JSON.stringify({ role: 'karyawan', name: 'Novi Yulianti', employeeId: 'emp-novi' }));
};

test('job cross-departemen yang di-assign tetap tampil di Daftar Kerjaan Saya', async ({ page }) => {
  await blockCloudSync(page);
  await page.addInitScript(seed);
  await page.goto('/');

  // Popup "Ada Kerjaan Baru" menampilkan job cross-departemen (Deker tangan)
  await expect(page.getByText('ADA KERJAAN BARU')).toBeVisible();
  await page.getByRole('button', { name: 'Lihat Kerjaan' }).click();

  // Job itu HARUS ada di Daftar Kerjaan Saya, bukan "Belum ada kerjaan aktif"
  await expect(page.getByRole('button', { name: /PROD\/2026\/0035/ })).toBeVisible();
  await expect(page.getByText('Belum ada kerjaan aktif.')).toHaveCount(0);

  // Job dept sendiri (tanpa assignment eksplisit) tetap tampil juga
  await expect(page.getByRole('button', { name: /PROD\/2026\/0036/ })).toBeVisible();
});
