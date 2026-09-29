import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1366, height: 1000 }, isMobile: false, hasTouch: false });

/**
 * Aplikasi ini dipakai harian, sedangkan localStorage hanya ±5 MB (iPhone paling
 * ketat). Foto resi lama yang masih base64 adalah beban terbesar, jadi:
 * - pemakaian cache harus terlihat di panel Penyimpanan;
 * - foto base64 bisa dipindahkan ke cloud storage (data lokal menyusut, tampilan tetap);
 * - cache audit & recycle (murni cache) bisa dibuang sekali klik.
 */
const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_orders', JSON.stringify([{
      id: 'ord-1', order_number: 'ORD/2026/09/001', customer_name: 'Toko A', customer_phone: '08',
      date: '2026-09-01', status: 'completed', items: [], payments: [], shipping_fee: 0, discount: 0, dp: 0,
      // ±60 KB base64 — meniru foto resi lama yang tersimpan di dalam cache
      shipping_proof_url: `data:image/jpeg;base64,${'A'.repeat(30000)}`,
    }]));
    localStorage.setItem('nxty_audit_logs', JSON.stringify([{
      id: 'log-1', timestamp: '2026-09-01T08:00:00+07:00', actor_name: 'H. Ari Gunawan',
      actor_role: 'owner', action: 'create', entity_type: 'order', description: 'Membuat order ORD/2026/09/001',
    }]));
    localStorage.setItem('nxty_recycle_bin', JSON.stringify([{
      id: 'rec-1', entity_type: 'orders', entity_id: 'ord-9', label: 'ORD/2026/09/009',
      data: {}, deleted_at: '2026-09-20T08:00:00+07:00', deleted_by_name: 'H. Ari Gunawan',
      expires_at: '2026-10-20T08:00:00+07:00',
    }]));
  });
};

const bukaPanel = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-audit').click();
  await expect(page.getByText('Penyimpanan di Perangkat Ini')).toBeVisible();
};

const proofUrl = (page: Page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem('nxty_orders') || '[]')[0]?.shipping_proof_url as string);

test('panel penyimpanan menunjukkan pemakaian dan key terbesar', async ({ page }) => {
  await seed(page);
  await bukaPanel(page);

  // Bar pemakaian vs anggaran aman, plus key terbesar ikut terlihat
  await expect(page.getByText(/\d+(\.\d)? (KB|MB) \/ 5\.0 MB/)).toBeVisible();
  await expect(page.getByText(/^orders ·/)).toBeVisible();
  await expect(page.getByText(/^audit_logs ·/)).toBeVisible();
});

test('foto bukti lama dipindahkan ke cloud dan cache base64-nya hilang', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await seed(page);
  // Unggahan ke Supabase Storage ditiru: tes tidak boleh menyentuh data produksi.
  // Didaftarkan SETELAH seed karena route Playwright dicocokkan dari yang terakhir
  // dipasang — blokir cloud bawaan isolate() harus kalah dari route khusus ini.
  await page.route('**/storage/v1/object/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ Key: 'delivery-photos/ORD-2026-09-001.jpg' }),
  }));
  await bukaPanel(page);

  expect(await proofUrl(page)).toMatch(/^data:image/);

  await page.getByRole('button', { name: /Pindahkan 1 foto lama ke cloud/ }).click();

  // Foto jadi tautan cloud, bukan lagi base64 di penyimpanan perangkat
  await expect.poll(() => proofUrl(page)).toContain('/storage/v1/object/public/delivery-photos/');
  await expect.poll(() => proofUrl(page)).not.toContain('base64');
  // Tombol pemindahan hilang karena tidak ada lagi foto base64
  await expect(page.getByRole('button', { name: /Pindahkan \d+ foto lama/ })).toHaveCount(0);
});

test('cache audit & recycle bisa dibuang tanpa menyentuh data aslinya', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await seed(page);
  await bukaPanel(page);

  await page.getByRole('button', { name: /Buang cache audit & recycle/ }).click();

  await expect.poll(() => page.evaluate(() => localStorage.getItem('nxty_audit_logs'))).toBeNull();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('nxty_recycle_bin'))).toBeNull();
  // Data transaksi tidak ikut terbuang
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('nxty_orders') || '[]').length)).toBe(1);
});
