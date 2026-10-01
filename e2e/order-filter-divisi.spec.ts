import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

/**
 * Dulu klik divisi di Daftar Pesanan hanya mengubah tabel, sedangkan kartu
 * ringkasan (Total Tagihan / Sudah Bayar / Piutang) diam saja karena hanya
 * mengikuti periode — terlihat seperti filter yang tidak bekerja.
 */
const seed = (tanggal: string) => {
  localStorage.setItem('nxty_employees', JSON.stringify([
    { id: 'emp-owner', username: 'ari', name: 'Ari Owner', department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 0, rate_lembur_per_jam: 0, status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false, access_role: 'owner' },
  ]));
  localStorage.setItem('nxty_orders', JSON.stringify([
    {
      id: 'o1', order_number: 'PO/1', customer_name: 'Pelanggan A', source: 'offline', date: tanggal,
      status: 'completed', total: 100000, shipping_fee: 0, discount: 0,
      items: [{ id: 'i1', department_id: 'dept-eva-foam', product_id: 'p1', product_name: 'Matras', variant: '-', qty: 1, price: 100000, subtotal: 100000 }],
    },
    {
      id: 'o2', order_number: 'PO/2', customer_name: 'Pelanggan B', source: 'offline', date: tanggal,
      status: 'completed', total: 200000, shipping_fee: 0, discount: 0,
      items: [{ id: 'i2', department_id: 'dept-konveksi', product_id: 'p2', product_name: 'Samsak', variant: '-', qty: 1, price: 200000, subtotal: 200000 }],
    },
  ]));
};

test('filter divisi di Daftar Pesanan mengubah tabel DAN kartu ringkasan', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript(seed, new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10));
  await page.goto('/');
  await page.locator('#nav-tab-penjualan').click();
  await page.getByRole('button', { name: 'Order Non-Marketplace' }).click();

  const kartu = page.getByRole('group', { name: 'Ringkasan order' });
  await expect(page.getByText('Menampilkan 2 dari 2 orderan')).toBeVisible();
  await expect(kartu).toContainText('Rp 300.000');
  await expect(kartu).toContainText('2 order aktif');

  // Eva Foam: tabel menyusut DAN kartu ikut menyesuaikan
  await page.getByRole('button', { name: 'Eva Foam', exact: true }).click();
  await expect(page.getByText('Menampilkan 1 dari 2 orderan')).toBeVisible();
  await expect(kartu).toContainText('Rp 100.000');
  await expect(kartu).toContainText('1 order aktif');

  // Konveksi
  await page.getByRole('button', { name: 'Konveksi', exact: true }).click();
  await expect(page.getByText('Menampilkan 1 dari 2 orderan')).toBeVisible();
  await expect(kartu).toContainText('Rp 200.000');

  // Kembali ke semua divisi
  await page.getByRole('button', { name: 'Semua Divisi' }).click();
  await expect(kartu).toContainText('Rp 300.000');
});

test('kartu ringkasan disembunyikan di tab Piutang Pelanggan', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript(seed, new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10));
  await page.goto('/');
  await page.locator('#nav-tab-penjualan').click();
  await page.getByRole('button', { name: 'Order Non-Marketplace' }).click();

  const kartu = page.getByRole('group', { name: 'Ringkasan order' });
  await expect(kartu).toBeVisible();

  await page.getByRole('button', { name: /Piutang Pelanggan/ }).click();
  await expect(kartu).toBeHidden();
});
