import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Karyawan mengajukan lembur / bonus Live TikTok saat scan pulang. Pengajuan
 * muncul di menu admin "Perlu Review" dengan alasannya, admin bisa mengoreksi
 * nilainya lalu setujui — dan lembur + live ikut ke slip gaji dalam satu
 * keputusan (dulu hanya salah satu yang bisa disimpan per scan).
 */
test('pengajuan lembur + live TikTok saat pulang masuk review admin dan mengalir ke slip', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = {
      department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 12000,
      default_live_tiktok_bonus: 25000, default_weekly_cash_advance_deduction: 0,
      status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
    };
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'Ari Owner', access_role: 'owner' },
      { ...base, id: 'emp-a', username: 'ayu', name: 'Ayu Lembur' },
    ]));

    const scan = (date: string, jam: string, type: 'masuk' | 'pulang', extra: object = {}) => ({
      id: `att-emp-a-${date}-${type}`, employee_id: 'emp-a', employee_name: 'Ayu Lembur',
      timestamp: `${date}T${jam}:00+07:00`, type_scan: type, latitude: 0, longitude: 0,
      distance_meters: 0, selfie_url: '', device_token: 'x', is_mock_location_flag: false,
      status: 'normal', late_minutes: 0, ...extra,
    });
    localStorage.setItem('nxty_attendance', JSON.stringify([
      scan('2026-08-19', '07:50', 'masuk'),
      scan('2026-08-19', '16:10', 'pulang', {
        overtime_request: { reason: 'bantu packing order besar', requested_at: '2026-08-19T16:10:00+07:00' },
        live_tiktok_request: { reason: 'live jam 19 sampai 21', requested_at: '2026-08-19T16:10:00+07:00' },
      }),
    ]));
  });

  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: /Perlu Review/ }).click();

  // Kartu review menampilkan pengajuan karyawan (hanya satu log pending)
  await expect(page.getByText('Diajukan karyawan')).toBeVisible();
  await expect(page.getByText('bantu packing order besar')).toBeVisible();
  await expect(page.getByText('live jam 19 sampai 21')).toBeVisible();

  // Admin koreksi menit lembur & simpan (nominal live sudah terisi default 25.000)
  await page.getByLabel('Lembur disetujui (menit)').fill('120');
  await page.getByRole('button', { name: 'Simpan Keputusan' }).click();

  // Antrean pending kosong, keputusan pindah ke Riwayat Keputusan
  await expect(page.getByText('Tidak ada pengajuan / lembur yang menunggu keputusan.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Riwayat Keputusan' })).toBeVisible();
  await expect(page.getByText('lembur 120m · live Rp 25.000')).toBeVisible();

  // Generate slip satuan untuk Ayu, periode mencakup 19 Agustus
  await page.getByRole('button', { name: 'Buku Register Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Generate Satuan' }).click();
  await page.getByLabel('Awal periode generate satuan').fill('2026-08-15');
  await page.getByLabel('Akhir periode generate satuan').fill('2026-08-21');
  await page.locator('select').first().selectOption({ label: 'Ayu Lembur' });

  // THP = 1 hari×100.000 + 2 jam lembur×12.000 + bonus live 25.000 = 149.000
  const modal = page.locator('form').filter({ hasText: 'Generate & Posting Slip' });
  await expect(modal.getByLabel('Jam Lembur ACC')).toHaveValue('2');
  await expect(modal.getByLabel('Bonus Otomatis / Tambahan')).toHaveValue('25000');

  await page.getByRole('button', { name: 'Generate & Posting Slip' }).click();
  await expect(page.getByText('149.000').first()).toBeVisible();
});
