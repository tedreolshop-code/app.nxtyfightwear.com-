import { test, expect } from '@playwright/test';
import { blockCloudSync } from './isolate';

test.use({ viewport: { width: 1366, height: 1000 }, isMobile: false, hasTouch: false });

// Seed minimal: 1 order produksi konveksi (target 10 pcs) yang sedang di tahap Potong,
// ditugaskan ke Asep (emp-asep, dept-konveksi) + 1 log harian lama (4 selesai, 1 reject).
const seed = () => {
  localStorage.setItem('nxty_employees', JSON.stringify([
    { id: 'emp-asep', username: 'asep', name: 'Asep Saputra', department_id: 'dept-konveksi', role: 'karyawan', pin: '1234', status_aktif: true, allowed_tabs: ['dashboard', 'produksi', 'absensi', 'gaji', 'profil'] },
  ]));
  localStorage.setItem('nxty_departments', JSON.stringify([
    { id: 'dept-konveksi', name: 'Konveksi' },
  ]));
  localStorage.setItem('nxty_production_jobs', JSON.stringify([
    {
      id: 'job-test-1', order_number: 'PROD/2026/TEST', department_id: 'dept-konveksi',
      product_id: 'p1', product_name: 'Body Test', variant: 'M', qty: 10,
      status: 'ongoing', current_stage: 'Potong', created_at: '2026-09-07T08:00:00+07:00',
      stages: [{ stage: 'Potong', status: 'ongoing' }, { stage: 'Jahit', status: 'pending' }],
      assigned_employees: [{ employee_id: 'emp-asep', employee_name: 'Asep Saputra' }],
    },
  ]));
  localStorage.setItem('nxty_production_task_logs', JSON.stringify([
    {
      id: 'log-lama', production_job_id: 'job-test-1', production_label: 'PROD/2026/TEST - Body Test',
      employee_id: 'emp-asep', employee_name: 'Asep Saputra', date: '2026-09-06',
      stage_name: 'Potong', task_name: 'Potong', qty_done: 4, qty_rejected: 1, created_at: '2026-09-06T09:00:00+07:00',
    },
  ]));
  localStorage.setItem('nxty_session', JSON.stringify({ role: 'karyawan', name: 'Asep Saputra', employeeId: 'emp-asep' }));
};

test('input harian dibatasi sisa target tahap', async ({ page }) => {
  await blockCloudSync(page);
  await page.addInitScript(seed);
  await page.goto('/');

  // Popup "Ada Kerjaan Baru" muncul otomatis untuk tugas yang belum pernah dibuka — masuk lewat tombolnya
  await page.getByRole('button', { name: 'Lihat Kerjaan' }).click();

  // Form input hasil kerja menampilkan sisa kuota: 10 - (4 selesai + 1 reject) = 5
  await page.getByRole('button', { name: /PROD\/2026\/TEST/ }).click();
  await expect(page.getByText(/Target tahap .*sudah tercatat 5/)).toBeVisible();
  await expect(page.getByText(/sisa 5/)).toBeVisible();

  // Input 3 pcs (masih dalam kuota) -> sukses: riwayat bertambah, sisa jadi 2, input dikosongkan
  await page.getByLabel('Qty Selesai').fill('3');
  await page.getByRole('button', { name: 'Simpan Hasil Kerja' }).click();
  await expect(page.getByText(/Target tahap .*sudah tercatat 8/)).toBeVisible();
  await expect(page.getByText(/sisa 2/)).toBeVisible();
  await expect(page.getByText('3 selesai')).toBeVisible();
  await expect(page.getByLabel('Qty Selesai')).toHaveValue('');

  // Input 5 pcs pada Qty Selesai (melebihi max=2) -> submit diblokir browser,
  // form tidak terkirim: input tidak terreset dan riwayat/kuota tidak berubah.
  await page.getByLabel('Qty Selesai').fill('5');
  await page.getByRole('button', { name: 'Simpan Hasil Kerja' }).click();
  await expect(page.getByLabel('Qty Selesai')).toHaveValue('5');
  await expect(page.getByText(/Target tahap .*sudah tercatat 8/)).toBeVisible();
  await expect(page.getByText('3 selesai')).toBeVisible();

  // Qty Selesai 2 (sah) + Qty Reject 1 -> total 3 melebihi sisa 2 -> ditolak alert JS (toast)
  await page.getByLabel('Qty Selesai').fill('2');
  await page.getByLabel('Qty Reject').fill('1');
  await page.getByRole('button', { name: 'Simpan Hasil Kerja' }).click();
  await expect(page.getByText(/Kuota tahap "Potong" tinggal 2/)).toBeVisible();
  // Tidak ada log baru: kuota tetap 8 tercatat
  await expect(page.getByText(/Target tahap .*sudah tercatat 8/)).toBeVisible();
});
