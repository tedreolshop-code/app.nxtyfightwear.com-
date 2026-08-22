import { test, expect, Page, Download } from '@playwright/test';
import { isolateAsOwner } from './isolate';
import fs from 'fs';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const hariIni = new Date().toISOString().slice(0, 10);

/** File yang diunduh harus workbook xlsx asli (zip, magic bytes "PK") — bukan CSV berganti nama. */
const cekXlsx = async (unduhan: Download) => {
  expect(unduhan.suggestedFilename()).toMatch(/\.xlsx$/);
  const path = await unduhan.path();
  expect(fs.readFileSync(path!).subarray(0, 2).toString()).toBe('PK');
};

const klikUnduh = async (page: Page, tombol: ReturnType<Page['getByRole']>) => {
  const [unduhan] = await Promise.all([page.waitForEvent('download'), tombol.click()]);
  await cekXlsx(unduhan);
};

test('Payroll: Ekspor Rekap menghasilkan .xlsx', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript((tgl) => {
    localStorage.setItem('nxty_payroll_weekly', JSON.stringify([{
      id: 'PAY/1', employee_id: 'emp-asep', employee_name: 'Asep Saputra',
      period_start: tgl, period_end: tgl, days_worked: 6, overtime_hours: 2,
      base_pay: 900000, bonus: 60000, cash_advance_deduction: 50000, total_pay: 910000,
      is_printed: false, payment_status: 'unpaid', created_at: `${tgl}T10:00:00+07:00`,
    }]));
  }, hariIni);
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('main').getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await klikUnduh(page, page.getByRole('button', { name: /Ekspor Rekap/ }));
});

test('Pembelian: Export PO menghasilkan .xlsx', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript((tgl) => {
    localStorage.setItem('nxty_purchases', JSON.stringify([{
      id: 'po1', po_number: 'PO/1', supplier: 'PT Sumber', date: tgl, status: 'received',
      department_id: 'dept-eva-foam', admin_staff: 'Admin', total_price: 500000,
      items: [{ id: 'i1', description: 'Eva Foam 2cm', qty: 10, price: 50000, subtotal: 500000 }],
    }]));
  }, hariIni);
  await page.goto('/');
  await page.locator('#nav-tab-pembelian').click();
  await klikUnduh(page, page.getByRole('button', { name: 'Export', exact: true }).first());
});

test('Marketplace: Export penjualan menghasilkan .xlsx', async ({ page }) => {
  await isolateAsOwner(page);
  // Modul marketplace memakai rentang tanggal bawaan 2026-05-01 s/d 2026-07-31
  await page.addInitScript(() => {
    const tgl = '2026-07-15';
    localStorage.setItem('nxty_marketplace_item_sales', JSON.stringify([{
      id: 's1', date: tgl, created_at: `${tgl}T09:00:00+07:00`, order_number: 'INV-001',
      marketplace_ref: 'Shopee', description: 'Matras 2cm', qty: 2, price: 150000,
      subtotal: 300000, admin_fee: 15000, total: 285000, admin_staff: 'Siti',
      status: 'terkirim', department_id: 'dept-eva-foam',
    }]));
  });
  await page.goto('/');
  await page.locator('#nav-tab-penjualan').click();
  await klikUnduh(page, page.getByRole('button', { name: 'Export ke Excel' }));
});
