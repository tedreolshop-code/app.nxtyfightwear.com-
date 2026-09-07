import { test, expect } from '@playwright/test';
import { blockCloudSync } from './isolate';

test.use({ viewport: { width: 1366, height: 1000 }, isMobile: false, hasTouch: false });

// Seed: order multi-output 3 varian Gentle Cup @10 pcs di tahap Potong (dept-konveksi).
// Owner login untuk membuka modal detail order (panel Rincian Item).
const seed = () => {
  localStorage.setItem('nxty_employees', JSON.stringify([
    { id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', department_id: 'dept-konveksi', role: 'leader', pin: '2026', status_aktif: true, access_role: 'owner' },
  ]));
  localStorage.setItem('nxty_departments', JSON.stringify([{ id: 'dept-konveksi', name: 'Konveksi' }]));
  localStorage.setItem('nxty_session', JSON.stringify({ role: 'owner', name: 'H. Ari Gunawan', employeeId: 'emp-owner' }));
  localStorage.setItem('nxty_production_jobs', JSON.stringify([
    {
      id: 'job-gentle', order_number: 'PROD/2026/0053', department_id: 'dept-konveksi',
      product_id: 'p-gentle', product_name: 'Gentle Cup', variant: 'Hitam M', qty: 10,
      status: 'ongoing', current_stage: 'Potong', created_at: '2026-09-07T08:00:00+07:00',
      stages: [{ stage: 'Potong', status: 'ongoing' }, { stage: 'Jahit', status: 'pending' }, { stage: 'Finishing', status: 'pending' }],
      outputs: [
        { product_id: 'p-gentle-s', product_name: 'Gentle Cup', variant: 'hitam S', target_qty: 10, good_qty: 0, reject_qty: 0 },
        { product_id: 'p-gentle-m', product_name: 'Gentle Cup', variant: 'Hitam M', target_qty: 10, good_qty: 0, reject_qty: 0 },
        { product_id: 'p-gentle-l', product_name: 'Gentle Cup', variant: 'Hitam L', target_qty: 10, good_qty: 0, reject_qty: 0 },
      ],
      assigned_employees: [{ employee_id: 'emp-owner', employee_name: 'H. Ari Gunawan' }],
    },
  ]));
  localStorage.setItem('nxty_production_task_logs', JSON.stringify([]));
};

test('rincian item di modal detail: tabel per varian + input hasil per item + jumlah', async ({ page }) => {
  await blockCloudSync(page);
  await page.addInitScript(seed);
  page.on('dialog', d => d.accept());
  await page.goto('/');
  await page.locator('#nav-tab-produksi').click();
  await page.getByRole('button', { name: 'Progress' }).click();

  // Buka modal detail order dari kartu tracker (klik nomor order di kartu kanban)
  await page.getByText('PROD/2026/0053').last().click();

  // Tabel Rincian Item tampil dengan target 10 per varian dan baris Jumlah
  await expect(page.getByText('Rincian Item & Input Hasil')).toBeVisible();
  const table = page.locator('table');
    await expect(table.getByRole('cell', { name: 'Gentle Cup (hitam S)' })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Gentle Cup (Hitam M)' })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Gentle Cup (Hitam L)' })).toBeVisible();
    await expect(table.getByText('Jumlah')).toBeVisible();

  // Input hasil: S = 10, M = 5, L = 7 -> baris Jumlah menunjukkan 22
  await page.getByLabel('Hasil Gentle Cup (hitam S)').fill('10');
  await page.getByLabel('Hasil Gentle Cup (Hitam M)').fill('5');
  await page.getByLabel('Hasil Gentle Cup (Hitam L)').fill('7');
  await expect(page.getByRole('button', { name: 'Simpan Hasil per Item' }).locator('..').getByText('22')).toBeVisible();

  // Simpan -> toast sukses, tabel terupdate: kolom Selesai per varian & baris Jumlah
  await page.getByRole('button', { name: 'Simpan Hasil per Item' }).click();
  await expect(page.getByText('Hasil 3 item pada tahap Potong berhasil dicatat.')).toBeVisible();
  const jumlahRow = page.getByRole('row', { name: /Jumlah/ });
  await expect(jumlahRow).toBeVisible();

  // Coba input melebihi sisa varian S (sudah penuh 10/10) -> ditolak dengan toast
  await page.getByLabel('Hasil Gentle Cup (hitam S)').fill('3');
  await page.getByRole('button', { name: 'Simpan Hasil per Item' }).click();
  await expect(page.getByText(/kuota tahap "Potong" tinggal 0/)).toBeVisible();
});
