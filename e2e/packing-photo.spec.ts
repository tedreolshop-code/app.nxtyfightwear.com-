import { test, expect, Page } from '@playwright/test';
import { blockCloudSync } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const seed = async (page: Page, role: 'owner' | 'karyawan') => {
  await blockCloudSync(page);
  await page.addInitScript((asEmp) => {
    localStorage.setItem('nxty_session', JSON.stringify(asEmp
      ? { role: 'karyawan', name: 'Asep Saputra', employeeId: 'emp-asep' }
      : { role: 'owner', name: 'H. Ari Gunawan', employeeId: 'emp-owner' }));
    localStorage.setItem('nxty_packing_tasks', JSON.stringify([
      { id: 'pack-1', order_id: 'ord-1', order_number: 'ORD/2026/07/009', customer_name: 'Dojo A', employee_id: 'emp-asep', employee_name: 'Asep Saputra', status: 'assigned', items: [{ id: 'it1', product_id: 'p1', product_name: 'Matras', variant: 'M', qty: 2 }], created_at: '2026-07-27T08:00:00+07:00' },
      { id: 'pack-2', order_id: 'ord-2', order_number: 'ORD/2026/07/008', customer_name: 'Dojo B', employee_id: 'emp-asep', employee_name: 'Asep Saputra', status: 'completed', items: [{ id: 'it2', product_id: 'p1', product_name: 'Matras', variant: 'M', qty: 1 }], created_at: '2026-07-26T08:00:00+07:00', completed_at: '2026-07-26T10:00:00+07:00' },
    ]));
  }, role === 'karyawan');
};

test('input foto packing karyawan membuka kamera belakang', async ({ page }) => {
  await seed(page, 'karyawan');
  await page.goto('/');
  await page.getByRole('button', { name: 'Lihat Kerjaan' }).click();
  await page.getByRole('button', { name: /ORD\/2026\/07\/009/ }).click();

  const input = page.locator('input[type=file]').first();
  // Tanpa capture, HP membuka pemilih berkas, bukan kamera
  await expect(input).toHaveAttribute('capture', 'environment');
  await expect(input).toHaveAttribute('accept', 'image/*');
});

test('packing selesai tanpa foto muncul di tab Dokumentasi dan bisa dilengkapi', async ({ page }) => {
  await seed(page, 'owner');
  await page.goto('/');
  // Tab dokumentasi foto packing ada di menu Penjualan, bukan Produksi
  await page.locator('#nav-tab-penjualan').click();
  await page.getByRole('button', { name: 'Dokumentasi Foto Packing' }).click();

  await expect(page.getByText('1 packing selesai belum ada fotonya')).toBeVisible();
  await expect(page.getByText('ORD/2026/07/008')).toBeVisible();
  await expect(page.getByText('Ambil / Pilih Foto')).toBeVisible();

  const input = page.locator('input[type=file]').first();
  await expect(input).toHaveAttribute('capture', 'environment');
});
