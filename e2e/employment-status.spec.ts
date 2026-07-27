import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// Dua karyawan absensinya sama-sama bersih (tanpa data absensi sama sekali):
// yang membedakan hanya status kepegawaian.
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
  });
};

const bukaDataKaryawan = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
};

test('status kepegawaian tampil dan bisa difilter di data karyawan', async ({ page }) => {
  await seed(page);
  await bukaDataKaryawan(page);

  await expect(page.getByRole('table').locator('thead')).toContainText('Status Kerja');
  await expect(page.getByRole('cell', { name: 'Cici Training' })).toBeVisible();

  await page.getByRole('combobox').filter({ hasText: 'Semua Status Kerja' }).selectOption('training');
  await expect(page.getByRole('cell', { name: 'Cici Training' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Budi Tetap' })).toHaveCount(0);
});

test('bonus kehadiran gugur untuk karyawan training, cair untuk karyawan', async ({ page }) => {
  await seed(page);
  await bukaDataKaryawan(page);
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Bonus Kehadiran' }).click();

  const barisTraining = page.getByRole('row').filter({ hasText: 'Cici Training' });
  await expect(barisTraining).toContainText('Masih berstatus training');
  await expect(barisTraining).toContainText('GUGUR');

  // Rekan yang absensinya sama tapi sudah karyawan tetap aman
  const barisTetap = page.getByRole('row').filter({ hasText: 'Budi Tetap' });
  await expect(barisTetap).not.toContainText('Masih berstatus training');
});
