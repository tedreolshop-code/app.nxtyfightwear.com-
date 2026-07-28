import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const EVA = 'dept-eva-foam';
const KONVEKSI = 'dept-konveksi';

const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript((div) => {
    localStorage.setItem('nxty_purchases', JSON.stringify([
      // Hutang Eva Foam, sudah dibayar sebagian, lewat jatuh tempo
      { id: 'po1', po_number: 'PO/1', supplier: 'Toko Eva', date: '2026-07-01', department_id: div.EVA,
        total_price: 1_000_000, status: 'completed', payment_method: 'hutang', due_date: '2026-07-10',
        payments: [{ id: 'p1', date: '2026-07-05', amount: 300_000 }],
        items: [{ id: 'i1', description: 'Eva sheet', qty: 1, price: 1_000_000, subtotal: 1_000_000 }] },
      // Hutang Konveksi, belum dibayar
      { id: 'po2', po_number: 'PO/2', supplier: 'Toko Kain', date: '2026-07-02', department_id: div.KONVEKSI,
        total_price: 500_000, status: 'completed', payment_method: 'hutang', due_date: '2026-08-30', payments: [],
        items: [{ id: 'i2', description: 'Kain', qty: 1, price: 500_000, subtotal: 500_000 }] },
      // Tunai, sudah lunas → tidak muncul kecuali "tampilkan yang lunas"
      { id: 'po3', po_number: 'PO/3', supplier: 'Toko Tunai', date: '2026-07-03',
        total_price: 200_000, status: 'completed', payment_method: 'tunai',
        payments: [{ id: 'p2', date: '2026-07-03', amount: 200_000 }],
        items: [{ id: 'i3', description: 'Lakban', qty: 1, price: 200_000, subtotal: 200_000 }] },
    ]));

    localStorage.setItem('nxty_orders', JSON.stringify([
      { id: 'ord1', order_number: 'ORD/1', customer_name: 'Dojo Eva', customer_phone: '08', source: 'offline',
        date: '2026-07-04', total: 800_000, status: 'completed', dp: 200_000, due_date: '2026-07-15',
        items: [{ id: 'oi1', product_id: 'p1', department_id: div.EVA, product_name: 'Matras', variant: 'M', qty: 1, price: 800_000, subtotal: 800_000 }] },
      { id: 'ord2', order_number: 'ORD/2', customer_name: 'Sasana Konveksi', customer_phone: '08', source: 'offline',
        date: '2026-07-06', total: 400_000, status: 'pending',
        items: [{ id: 'oi2', product_id: 'p2', department_id: div.KONVEKSI, product_name: 'Samsak', variant: 'L', qty: 1, price: 400_000, subtotal: 400_000 }] },
    ]));
  }, { EVA, KONVEKSI });
};

test('hutang supplier: sisa, jatuh tempo, filter divisi, dan cicilan', async ({ page }) => {
  await seed(page);
  page.on('dialog', d => d.accept());
  await page.goto('/');
  await page.locator('#nav-tab-pembelian').click();
  await page.getByRole('button', { name: /Hutang Supplier/ }).click();

  // PO tunai yang lunas tidak ikut, jadi sisa = 700rb + 500rb
  await expect(page.getByText('Rp 1.200.000').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'PO/3' })).toHaveCount(0);

  // Lewat jatuh tempo hanya PO/1 (10 Juli)
  const baris1 = page.getByRole('row').filter({ hasText: 'PO/1' });
  await expect(baris1).toContainText('lewat tempo');

  // Filter divisi
  await page.getByRole('button', { name: 'Konveksi', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'PO/2' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'PO/1' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Semua Divisi', exact: true }).click();

  // Cicil 200rb dari sisa 700rb → sisa jadi 500rb
  await baris1.getByRole('button', { name: 'Bayar' }).click();
  // Modal pembayaran: satu-satunya input angka yang tampil
  await page.locator('input[type=number]:visible').fill('200000');
  await page.getByRole('button', { name: 'Simpan Pembayaran' }).click();

  await expect(page.getByRole('row').filter({ hasText: 'PO/1' })).toContainText('Rp 500.000');
  await expect(page.getByRole('row').filter({ hasText: 'PO/1' })).toContainText('Sebagian');
});

test('piutang pelanggan: DP lama terbaca dan pelunasan mengubah status', async ({ page }) => {
  await seed(page);
  page.on('dialog', d => d.accept());
  await page.goto('/');
  await page.locator('#nav-tab-penjualan').click();
  await page.getByRole('button', { name: 'Order Non-Marketplace' }).click();
  await page.getByRole('button', { name: /Piutang Pelanggan/ }).click();

  // DP lama Rp200.000 dianggap sudah dibayar, sisa Rp600.000
  const barisEva = page.getByRole('row').filter({ hasText: 'ORD/1' });
  await expect(barisEva).toContainText('Rp 600.000');
  await expect(barisEva).toContainText('Sebagian');

  // Order tanpa pembayaran berstatus belum bayar
  await expect(page.getByRole('row').filter({ hasText: 'ORD/2' })).toContainText('Belum Bayar');

  // Lunasi ORD/1 (bawaan jumlahnya = sisa)
  await barisEva.getByRole('button', { name: 'Bayar' }).click();
  await page.getByRole('button', { name: 'Simpan Pembayaran' }).click();

  // Setelah lunas, baris hilang dari daftar belum lunas
  await expect(page.getByRole('row').filter({ hasText: 'ORD/1' })).toHaveCount(0);
  await page.getByLabel(/Tampilkan yang lunas/i).check();
  await expect(page.getByRole('row').filter({ hasText: 'ORD/1' })).toContainText('Lunas');
});
