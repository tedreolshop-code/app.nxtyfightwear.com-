import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// Periode gaji mingguan Sab 2026-07-04 s/d Jum 2026-07-10.
// Absensi asli hanya ada di 3 hari; sisanya HARUS tampil tidak hadir, bukan dikarang.
const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_payroll_weekly', JSON.stringify([{
      id: 'PAY/1', employee_id: 'emp-asep', employee_name: 'Asep Saputra',
      period_start: '2026-07-04', period_end: '2026-07-10',
      days_worked: 3, overtime_hours: 2, base_pay: 450000, bonus: 20000,
      cash_advance_deduction: 50000, total_pay: 460000,
      is_printed: false, payment_status: 'unpaid', created_at: '2026-07-10T10:00:00+07:00',
    }]));
    const scan = (id: string, tgl: string, jenis: string) => ({
      id, employee_id: 'emp-asep', employee_name: 'Asep Saputra',
      timestamp: `${tgl}T07:55:00.000+07:00`, type_scan: jenis, status: 'normal',
      latitude: 0, longitude: 0, distance_meters: 3, is_mock_location_flag: false,
    });
    localStorage.setItem('nxty_attendance', JSON.stringify([
      scan('a1', '2026-07-04', 'masuk'),
      scan('a2', '2026-07-06', 'masuk'),
      scan('a3', '2026-07-07', 'masuk'),
    ]));
  });
};

const bukaSlip = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('main').getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByTitle(/Cetak Slip Gaji/).first().click();
  return page.getByText('Pratinjau Slip Gaji').locator('xpath=ancestor::div[3]');
};

test('slip menampilkan hadir murni dari absensi, tanpa mengarang hari', async ({ page }) => {
  await seed(page);
  const slip = await bukaSlip(page);

  // 3 hari hadir tercatat, dari 7 hari periode
  await expect(slip.getByText(/Hadir\s*3\s*dari 7 hari/)).toBeVisible();

  // Kolom tanggal 4, 6, 7 = H; tanggal 5, 8, 9, 10 = tidak hadir
  const sel = slip.locator('table').first();
  const hadir = await sel.locator('tbody td').allInnerTexts();
  expect(hadir).toEqual(['H', '–', 'H', 'H', '–', '–', '–']);
});

test('slip tidak menampilkan detail jam masuk/pulang', async ({ page }) => {
  await seed(page);
  const slip = await bukaSlip(page);
  await expect(slip).not.toContainText('07:55');
  await expect(slip).not.toContainText(/\d{2}:\d{2}/);
});

test('slip memakai identitas perusahaan dan kolom tanda tangan kosong', async ({ page }) => {
  await seed(page);
  const slip = await bukaSlip(page);

  await expect(slip.getByText('ARI SPORTINDO').first()).toBeVisible();
  await expect(slip.getByText('Slip Gaji', { exact: true })).toBeVisible();
  // Periode ditulis lengkap, bukan sekadar nama bulan
  await expect(slip.getByText('4 Juli 2026 – 10 Juli 2026')).toBeVisible();
  // Terbilang & total
  await expect(slip.getByText('empat ratus enam puluh ribu rupiah')).toBeVisible();
  // Kolom tanda tangan disediakan kosong, tidak ada coretan tanda tangan otomatis
  await expect(slip.getByText('Diterima oleh,')).toBeVisible();
  await expect(slip.getByText('Dibayarkan oleh,')).toBeVisible();
  await expect(slip.locator('svg path[d^="M15 35"]')).toHaveCount(0);
});
