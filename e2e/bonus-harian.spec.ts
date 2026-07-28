import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = {
      department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      default_attendance_bonus: 300000, status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
    };
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', access_role: 'owner' },
      { ...base, id: 'emp-tetap', username: 'tetap', name: 'Budi Tetap', employment_status: 'karyawan' },
      { ...base, id: 'emp-training', username: 'training', name: 'Cici Training', employment_status: 'training' },
    ]));
    localStorage.setItem('nxty_attendance', JSON.stringify([]));
  });
};

test('posisi bonus hari ini tampil tanpa menunggu awal bulan', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Bonus Kehadiran' }).click();

  // Ringkasan harian terbuka langsung, tanpa mengganti pilihan bulan
  const ringkasan = page.getByText(/Posisi hari ini ·/);
  await expect(ringkasan).toBeVisible();
  await expect(ringkasan).toContainText('sisa');
  await expect(ringkasan).toContainText('hari kerja');

  // Satu baris per karyawan aktif, dengan status hari ini
  const tabel = page.locator('details table');
  await expect(tabel.locator('thead th')).toHaveText(['Karyawan', 'Hadir', 'Telat', 'Status', 'Saldo Berjalan', 'Penuh']);
  await expect(tabel.getByRole('row').filter({ hasText: 'Budi Tetap' })).toBeVisible();

  // Yang training tetap muncul dengan penanda, dan bonusnya gugur
  const barisTraining = tabel.getByRole('row').filter({ hasText: 'Cici Training' });
  await expect(barisTraining).toContainText('Training');
  await expect(barisTraining).toContainText('GUGUR');

  // Kartu saldo berjalan menyebut progres hari kerja dan sisa harinya
  await expect(page.getByText(/Saldo bonus berjalan/)).toBeVisible();
  await expect(page.getByText(/hari kerja terlewati · sisa \d+ hari lagi/)).toBeVisible();
});

test('tanggal mulai berlaku absensi menyelamatkan bonus dari hari sebelum sistem dipakai', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = {
      department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      default_attendance_bonus: 300000, status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
    };
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', access_role: 'owner' },
    ]));
    // Absen hanya tercatat sejak 20 Juli; hari sebelumnya sistem belum dipakai
    const scans: any[] = [];
    for (let d = 20; d <= 27; d++) {
      const tgl = `2026-07-${String(d).padStart(2, '0')}`;
      if (new Date(`${tgl}T00:00:00Z`).getUTCDay() === 0) continue;
      scans.push({
        id: `a-${d}`, employee_id: 'emp-owner', employee_name: 'H. Ari Gunawan',
        timestamp: `${tgl}T07:30:00+07:00`, type_scan: 'masuk', latitude: 0, longitude: 0,
        distance_meters: 1, selfie_url: '', device_token: 'x', is_mock_location_flag: false,
        status: 'normal', late_minutes: 0,
      });
    }
    localStorage.setItem('nxty_attendance', JSON.stringify(scans));
    const settings = JSON.parse(localStorage.getItem('nxty_work_settings') || '{}');
    localStorage.setItem('nxty_work_settings', JSON.stringify({ ...settings, attendance_effective_from: '2026-07-20' }));
  });

  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Bonus Kehadiran' }).click();

  // Hanya hari sejak 20 Juli yang dinilai, jadi kehadirannya penuh dan bonus aman
  const baris = page.locator('details table').getByRole('row').filter({ hasText: 'H. Ari Gunawan' });
  await expect(baris).toContainText('AMAN');

  // Saldo berjalan berupa rupiah, lebih kecil dari nilai penuh karena bulan belum selesai
  const angka = (await baris.locator('td').allInnerTexts()).slice(-2).map(t => Number(t.replace(/\D/g, '')));
  const [saldo, penuh] = angka;
  expect(penuh).toBe(300000);
  expect(saldo).toBeGreaterThan(0);
  expect(saldo).toBeLessThan(penuh);

  // Kartu ringkasan juga menampilkan saldo rupiah, bukan hanya jumlah karyawan
  await expect(page.getByText(/Saldo bonus berjalan/)).toBeVisible();
  await expect(page.getByText(/penuh bulan ini Rp/)).toBeVisible();
});

test('panel menjelaskan sendiri kenapa saldo berjalan nol', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = {
      department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
    };
    localStorage.setItem('nxty_employees', JSON.stringify([
      // Nilai bonus 0 → saldo nol walau kehadirannya bersih
      { ...base, id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', access_role: 'owner', default_attendance_bonus: 0 },
    ]));
    localStorage.setItem('nxty_attendance', JSON.stringify([])); // tidak ada absensi sama sekali
    const settings = JSON.parse(localStorage.getItem('nxty_work_settings') || '{}');
    localStorage.setItem('nxty_work_settings', JSON.stringify({ ...settings, monthly_bonus_amount: 0 }));
  });

  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Bonus Kehadiran' }).click();

  const diagnosa = page.getByText('Kenapa saldonya nol?').locator('..');
  await expect(diagnosa).toContainText('hari kerja');
  await expect(diagnosa).toContainText('Absensi Mulai Berlaku');
  await expect(diagnosa).toContainText('nilai bonusnya masih Rp0');
});
