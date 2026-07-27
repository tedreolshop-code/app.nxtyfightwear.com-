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
  await expect(tabel.locator('thead th')).toHaveText(['Karyawan', 'Hadir', 'Telat', 'Status', 'Bonus']);
  await expect(tabel.getByRole('row').filter({ hasText: 'Budi Tetap' })).toBeVisible();

  // Yang training tetap muncul dengan penanda, dan bonusnya gugur
  const barisTraining = tabel.getByRole('row').filter({ hasText: 'Cici Training' });
  await expect(barisTraining).toContainText('Training');
  await expect(barisTraining).toContainText('GUGUR');

  // Kartu bonus berjalan menyebut sisa hari kerja bulan ini
  await expect(page.getByText(/sisa \d+ hari kerja lagi bulan ini/)).toBeVisible();
});
