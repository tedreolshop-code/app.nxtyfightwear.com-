import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Satu produk bisa punya beberapa ukuran/warna (Matras Beladiri 2cm: Hitam, Biru,
 * Merah-Biru). Bila varian tidak ikut tampil saat ACC, penerima tidak tahu barang
 * mana yang sedang dia terima.
 */
test('varian barang ikut tampil saat ACC serah-terima produksi', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_employees', JSON.stringify([{
      id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', department_id: 'dept-eva-foam',
      role: 'leader', rate_harian: 1, rate_lembur_per_jam: 1, status_aktif: true, phone_number: '08',
      pin: 'x', pin_hashed: false, access_role: 'owner',
    }]));
    localStorage.setItem('nxty_production_jobs', JSON.stringify([{
      id: 'job-1', product_id: 'p1', product_name: 'Matras Beladiri 2cm', variant: 'Merah-Biru',
      qty: 42, department_id: 'dept-eva-foam', status: 'ongoing', current_stage: 'Cetak',
      created_at: '2026-08-24T08:00:00+07:00',
      stages: [{ stage: 'Potong', status: 'completed' }, { stage: 'Cetak', status: 'ongoing' }],
    }]));
    localStorage.setItem('nxty_production_handoffs', JSON.stringify([
      // Baris BARU (sudah menyimpan varian sendiri)
      { id: 'h-baru', job_id: 'job-1', product_name: 'Matras Beladiri 2cm', variant: 'Merah-Biru',
        from_stage: 'Potong', to_stage: 'Cetak', from_department_id: 'dept-eva-foam',
        to_department_id: 'dept-eva-foam', from_employee_id: 'emp-x', from_employee_name: 'Budi',
        to_employee_id: 'emp-owner', to_employee_name: 'H. Ari Gunawan',
        qty_sent: 20, qty_rejected: 0, status: 'pending', created_at: '2026-08-24T09:00:00+07:00' },
      // Baris LAMA (tanpa varian) — varian harus diambilkan dari pekerjaan produksinya
      { id: 'h-lama', job_id: 'job-1', product_name: 'Matras Beladiri 2cm',
        from_stage: 'Potong', to_stage: 'Cetak', from_department_id: 'dept-eva-foam',
        to_department_id: 'dept-eva-foam', from_employee_id: 'emp-y', from_employee_name: 'Asep',
        to_employee_id: 'emp-owner', to_employee_name: 'H. Ari Gunawan',
        qty_sent: 22, qty_rejected: 0, status: 'pending', created_at: '2026-08-24T09:30:00+07:00' },
    ]));
  });
  await page.goto('/');

  // Popup tugas produksi baru muncul lebih dulu — varian harus tersebut di situ juga
  const popup = page.getByText('Tugas Produksi Baru');
  await expect(popup).toBeVisible();
  await expect(page.getByText('Varian: Merah-Biru')).toBeVisible();
  await page.getByRole('button', { name: 'Lihat & Konfirmasi' }).click();

  await page.getByRole('button', { name: 'Progress' }).click();

  // Kedua kartu ACC menyebut varian, termasuk data lama yang belum menyimpannya
  const kartuBaru = page.locator('.border-amber-200').filter({ hasText: 'Dari Budi' });
  await expect(kartuBaru).toContainText('Matras Beladiri 2cm');
  await expect(kartuBaru).toContainText('Merah-Biru');

  const kartuLama = page.locator('.border-amber-200').filter({ hasText: 'Dari Asep' });
  await expect(kartuLama).toContainText('Merah-Biru');
});
