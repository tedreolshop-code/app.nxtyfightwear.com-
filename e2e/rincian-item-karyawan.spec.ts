import { test, expect } from '@playwright/test';
import { blockCloudSync } from './isolate';

test.use({ viewport: { width: 1366, height: 1000 }, isMobile: false, hasTouch: false });

// Karyawan multi-output: form input harian menampilkan tabel per item dengan sisa per varian
const seed = () => {
  localStorage.setItem('nxty_employees', JSON.stringify([
    { id: 'emp-asep', username: 'asep', name: 'Asep Saputra', department_id: 'dept-konveksi', role: 'karyawan', pin: '1234', status_aktif: true, allowed_tabs: ['dashboard', 'produksi', 'absensi', 'gaji', 'profil'] },
  ]));
  localStorage.setItem('nxty_departments', JSON.stringify([{ id: 'dept-konveksi', name: 'Konveksi' }]));
  localStorage.setItem('nxty_production_jobs', JSON.stringify([
    {
      id: 'job-gentle', order_number: 'PROD/2026/0053', department_id: 'dept-konveksi',
      product_id: 'p-gentle', product_name: 'Gentle Cup', variant: 'Hitam M', qty: 10,
      status: 'ongoing', current_stage: 'Potong', created_at: '2026-09-07T08:00:00+07:00',
      stages: [{ stage: 'Potong', status: 'ongoing' }, { stage: 'Jahit', status: 'pending' }],
      outputs: [
        { product_id: 'p-gentle-s', product_name: 'Gentle Cup', variant: 'hitam S', target_qty: 10, good_qty: 0, reject_qty: 0 },
        { product_id: 'p-gentle-m', product_name: 'Gentle Cup', variant: 'Hitam M', target_qty: 10, good_qty: 0, reject_qty: 0 },
      ],
      assigned_employees: [{ employee_id: 'emp-asep', employee_name: 'Asep Saputra' }],
    },
  ]));
  localStorage.setItem('nxty_production_task_logs', JSON.stringify([]));
  localStorage.setItem('nxty_session', JSON.stringify({ role: 'karyawan', name: 'Asep Saputra', employeeId: 'emp-asep' }));
};

test('form harian karyawan: input hasil per item', async ({ page }) => {
  await blockCloudSync(page);
  await page.addInitScript(seed);
  await page.goto('/');
  await page.getByRole('button', { name: 'Lihat Kerjaan' }).click();
  await page.getByText('PROD/2026/0053').click();

  // Tabel per item tampil di form harian dengan sisa 10 per varian
  await expect(page.getByText('Hasil per Item')).toBeVisible();
  await page.getByLabel('Selesai Gentle Cup (hitam S)').fill('4');
  await page.getByLabel('Selesai Gentle Cup (Hitam M)').fill('6');

  // Simpan -> dua catatan tersendiri; tabel kembali kosong (sisa 6 & 4)
  await page.getByRole('button', { name: 'Simpan Hasil Kerja' }).click();
  await expect(page.getByText('Hasil kerja 2 item berhasil dicatat.')).toBeVisible();
  await expect(page.getByText('4 selesai').first()).toBeVisible();
  await expect(page.getByText('6 selesai').first()).toBeVisible();
});
