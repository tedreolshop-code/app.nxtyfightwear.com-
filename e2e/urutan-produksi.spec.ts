import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_production_jobs', JSON.stringify([
      { id: 'a', order_number: 'PROD/2026/a', department_id: 'dept-eva-foam', product_id: 'p1', product_name: 'Anwar Matras', variant: 'biru', qty: 1, status: 'ongoing', current_stage: 'Potong', created_at: '2026-08-01T08:00:00', stages: [{ stage: 'Potong', status: 'ongoing' }] },
      { id: 'b', order_number: 'PROD/2026/b', department_id: 'dept-eva-foam', product_id: 'p2', product_name: 'Zebra Matras', variant: 'merah', qty: 1, status: 'ongoing', current_stage: 'Potong', created_at: '2026-08-20T08:00:00', stages: [{ stage: 'Potong', status: 'ongoing' }] },
    ]));
  });
};

const judulPertama = (page: Page) => page.getByRole('heading', { level: 4 }).first();
const urutkan = (page: Page, label: string) => page.getByTitle('Urutkan daftar pekerjaan').selectOption({ label });

test('daftar pekerjaan produksi bisa diurutkan nama & tanggal', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#nav-tab-produksi').click();
  await page.getByRole('button', { name: 'Progress' }).click();

  await expect(judulPertama(page)).toHaveText('Zebra Matras'); // default: tanggal terbaru
  await urutkan(page, 'Tanggal Terlama');
  await expect(judulPertama(page)).toHaveText('Anwar Matras');
  await urutkan(page, 'Nama Z-A');
  await expect(judulPertama(page)).toHaveText('Zebra Matras');
  await urutkan(page, 'Nama A-Z');
  await expect(judulPertama(page)).toHaveText('Anwar Matras');
});
