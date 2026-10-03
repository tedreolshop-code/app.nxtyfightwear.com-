import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

/**
 * KPI "Total Pengeluaran Kas" & "Total Pembelian PO" harus mengikuti filter
 * aktif (bulan/kategori/supplier/pencarian/divisi) — konsisten dengan daftar
 * di bawahnya. Sebelumnya angkanya selalu total semua waktu walau filter
 * "bulan berjalan" dipilih.
 */

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_daily_expenses', JSON.stringify([
      // Bulan berjalan saat tes dibuat
      { id: 'exp-okt-1', date: '2026-10-05', category: 'Transport', description: 'BBM operasional', amount: 100000, admin_name: 'Admin A' },
      { id: 'exp-okt-2', date: '2026-10-20', category: 'Konsumsi', description: 'Snack karyawan', amount: 250000, admin_name: 'Admin A' },
      // Bulan lampau
      { id: 'exp-sep-1', date: '2026-09-10', category: 'Transport', description: 'BBM operasional', amount: 500000, admin_name: 'Admin A' },
      { id: 'exp-sep-2', date: '2026-09-15', category: 'Sewa', description: 'Sewa gedung', amount: 2000000, admin_name: 'Admin A' },
    ]));
    localStorage.setItem('nxty_purchases', JSON.stringify([
      { id: 'po-okt-1', po_number: 'PO-001', date: '2026-10-08', supplier: 'Toko A', department_id: '', status: 'completed', items: [{ id: 'i1', description: 'Eva Foam', qty: 10, price: 20000, subtotal: 200000 }], total_price: 200000, paid_amount: 0 },
      { id: 'po-sep-1', po_number: 'PO-002', date: '2026-09-08', supplier: 'Toko B', department_id: '', status: 'completed', items: [{ id: 'i2', description: 'Kain', qty: 5, price: 30000, subtotal: 150000 }], total_price: 150000, paid_amount: 0 },
    ]));
  });
};

test('Total Pengeluaran Kas ikut berubah saat filter bulan dipilih', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#nav-tab-pengeluaran').click();

  // Semua bulan: 100k + 250k + 500k + 2jt
  await expect(page.getByText('Total Pengeluaran Kas')).toBeVisible();
  await expect(page.getByText('4 Transaksi operasional tercatat')).toBeVisible();

  // Pilih bulan berjalan (Oktober 2026) di filter bulan bagian pengeluaran
  const monthSelect = page.locator('select').filter({ has: page.locator('option[value="All"]') }).filter({ hasText: 'Semua Bulan' });
  await monthSelect.last().selectOption('2026-10');

  const kpiExpense = page.locator('span.text-xl.font-black.text-rose-700');
  // 100k + 250k — angka bulan September tidak boleh ikut terhitung
  await expect(kpiExpense).toHaveText(/Rp\s?350\.000/);
});

test('Total Pembelian PO ikut berubah saat filter bulan dipilih', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#nav-tab-pembelian').click();

  await expect(page.getByText('Total Pembelian PO')).toBeVisible();

  const monthSelect = page.locator('select').filter({ has: page.locator('option[value="All"]') }).filter({ hasText: 'Semua Bulan' });
  await monthSelect.first().selectOption('2026-10');

  const kpiPo = page.locator('span.text-xl.font-black.text-emerald-800');
  // 1 PO Oktober = 200k — angka PO September (150k) tidak boleh ikut
  await expect(kpiPo).toHaveText(/Rp\s?200\.000/);
  await expect(page.getByText('1 Dokumen PO diterbitkan')).toBeVisible();
});
