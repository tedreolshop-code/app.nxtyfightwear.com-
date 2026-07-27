import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const EVA = 'dept-eva-foam';
const KONVEKSI = 'dept-konveksi';

const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript((div) => {
    localStorage.setItem('nxty_purchases', JSON.stringify([
      { id: 'po1', po_number: 'PO/1', supplier: 'Toko A', date: '2026-07-20', department_id: div.EVA, total_price: 100000, status: 'completed', items: [{ id: 'i1', description: 'Eva sheet', qty: 1, price: 100000, subtotal: 100000 }] },
      { id: 'po2', po_number: 'PO/2', supplier: 'Toko B', date: '2026-07-21', department_id: div.KONVEKSI, total_price: 200000, status: 'completed', items: [{ id: 'i2', description: 'Kain', qty: 1, price: 200000, subtotal: 200000 }] },
      { id: 'po3', po_number: 'PO/3', supplier: 'Toko C', date: '2026-07-22', total_price: 50000, status: 'completed', items: [{ id: 'i3', description: 'Lakban', qty: 1, price: 50000, subtotal: 50000 }] },
    ]));
    localStorage.setItem('nxty_daily_expenses', JSON.stringify([
      { id: 'e1', date: '2026-07-20', category: 'Konsumsi & Lembur', description: 'Makan lembur cetak', amount: 50000, admin_name: 'Admin', department_id: div.EVA },
      { id: 'e2', date: '2026-07-21', category: 'Lain-lain / Overhead', description: 'Listrik pabrik', amount: 900000, admin_name: 'Admin' },
    ]));
  }, { EVA, KONVEKSI });
};

const bukaMenu = async (page: Page, id: 'pembelian' | 'pengeluaran') => {
  await page.goto('/');
  await page.locator(`#nav-tab-${id}`).click();
};

test('pembelian bisa difilter per divisi dan menampilkan kolom divisi', async ({ page }) => {
  await seed(page);
  await bukaMenu(page, 'pembelian');

  await expect(page.getByRole('table').locator('thead')).toContainText('DIVISI');
  await expect(page.getByText('PO/1')).toBeVisible();
  await expect(page.getByText('PO/2')).toBeVisible();

  await page.getByRole('button', { name: 'Eva Foam', exact: true }).click();
  await expect(page.getByText('PO/1')).toBeVisible();
  await expect(page.getByText('PO/2')).toHaveCount(0);
  await expect(page.getByText('PO/3')).toHaveCount(0); // Bersama tidak bocor ke divisi

  await page.getByRole('button', { name: 'Bersama', exact: true }).click();
  await expect(page.getByText('PO/3')).toBeVisible();
  await expect(page.getByText('PO/1')).toHaveCount(0);
});

test('pengeluaran bisa difilter per divisi, biaya bersama punya ember sendiri', async ({ page }) => {
  await seed(page);
  await bukaMenu(page, 'pengeluaran');

  await expect(page.getByText('Makan lembur cetak')).toBeVisible();
  await expect(page.getByText('Listrik pabrik')).toBeVisible();

  await page.getByRole('button', { name: 'Eva Foam', exact: true }).click();
  await expect(page.getByText('Makan lembur cetak')).toBeVisible();
  await expect(page.getByText('Listrik pabrik')).toHaveCount(0);

  await page.getByRole('button', { name: 'Bersama', exact: true }).click();
  await expect(page.getByText('Listrik pabrik')).toBeVisible();
  await expect(page.getByText('Makan lembur cetak')).toHaveCount(0);
});
