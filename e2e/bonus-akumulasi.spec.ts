import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Contoh dari pemilik usaha:
 * 1 Juli masuk tanpa telat + pulang lewat 16:00 → dapat Rp10.000
 * 2 Juli sama → saldo jadi Rp20.000
 * 3 Juli telat → tidak dapat hari itu, tapi saldo TETAP Rp20.000 (tidak hangus)
 */
const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_employees', JSON.stringify([{
      id: 'emp-owner', username: 'ari', name: 'Karyawan A', access_role: 'owner',
      department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      default_attendance_bonus: 10000, status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
      employment_status: 'karyawan',
    }]));

    const scan = (tgl: string, jenis: 'masuk' | 'pulang', jam: string, late = 0) => ({
      id: `${tgl}-${jenis}`, employee_id: 'emp-owner', employee_name: 'Karyawan A',
      timestamp: `${tgl}T${jam}:00+07:00`, type_scan: jenis, latitude: 0, longitude: 0,
      distance_meters: 1, selfie_url: '', device_token: 'x', is_mock_location_flag: false,
      status: 'normal', late_minutes: late, work_fraction: 1,
    });

    localStorage.setItem('nxty_attendance', JSON.stringify([
      scan('2026-07-01', 'masuk', '07:50'), scan('2026-07-01', 'pulang', '16:10'),
      scan('2026-07-02', 'masuk', '07:55'), scan('2026-07-02', 'pulang', '16:05'),
      scan('2026-07-03', 'masuk', '08:20', 20), scan('2026-07-03', 'pulang', '16:30'), // telat
    ]));

    const settings = JSON.parse(localStorage.getItem('nxty_work_settings') || '{}');
    localStorage.setItem('nxty_work_settings', JSON.stringify({
      ...settings, start_time: '08:00', end_time: '16:00',
      attendance_effective_from: '2026-07-01',
    }));
  });
};

test('bonus kehadiran menumpuk per hari dan tidak hangus saat telat', async ({ page }) => {
  await seed(page);
  await page.goto('/');

  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Bonus Kehadiran' }).click();

  // Saldo dua hari layak = Rp20.000, meski 3 Juli telat (Intl memakai spasi tak-putus)
  const baris = page.locator('details table').getByRole('row').filter({ hasText: 'Karyawan A' });
  const isi = (await baris.innerText()).replace(/\u00a0/g, ' ');
  expect(isi).toContain('Rp 20.000');   // saldo terkumpul
  expect(isi).toContain('2x Rp 10.000'); // dua hari layak
  expect(isi).toContain('1 hari');       // satu hari telat, tapi saldo tidak hangus

  // Kartu ringkasan menunjukkan saldo yang sama
  await expect(page.getByText(/Saldo bonus berjalan/)).toBeVisible();
});
