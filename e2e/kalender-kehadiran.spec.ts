import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false });

/**
 * Kalender kehadiran di profil karyawan (admin). Yang penting: TIDAK salah paham —
 * hari libur / sebelum karyawan masuk / sebelum absensi dipakai tidak boleh
 * ditandai "tidak hadir".
 */
test('kalender kehadiran memisahkan libur & belum-berlaku dari tidak hadir', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = {
      department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false,
    };
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', access_role: 'owner' },
      { ...base, id: 'emp-a', username: 'siti', name: 'Siti Rahma', join_date: '2026-08-05' },
    ]));
    const ws = JSON.parse(localStorage.getItem('nxty_work_settings') || '{}');
    localStorage.setItem('nxty_work_settings', JSON.stringify({
      ...ws, start_time: '08:00', end_time: '16:00', half_day_start: '12:00', full_day_from: '14:00',
      attendance_effective_from: '2026-08-01',
    }));
    const scan = (d: string, jam: string, type: string, extra: object = {}) => ({
      id: `att-emp-a-2026-08-${d}-${type}`, employee_id: 'emp-a', employee_name: 'Siti Rahma',
      timestamp: `2026-08-${d}T${jam}:00+07:00`, type_scan: type, latitude: 0, longitude: 0,
      distance_meters: 12, selfie_url: '', device_token: 'x', is_mock_location_flag: false, status: 'normal', late_minutes: 0, ...extra,
    });
    const A: object[] = [];
    for (const d of ['05', '06', '07']) A.push(scan(d, '07:50', 'masuk'), scan(d, '16:10', 'pulang'));   // 3 hadir
    A.push(scan('10', '08:20', 'masuk', { late_minutes: 20 }), scan('10', '16:05', 'pulang'));            // 1 catatan (telat)
    A.push(scan('11', '07:55', 'masuk'));                                                                 // 1 catatan (tanpa pulang)
    A.push(scan('08', undefined as unknown as string, 'x')); // dummy dibuang oleh filter type_scan
    localStorage.setItem('nxty_attendance', JSON.stringify(A.filter((s: object) => (s as { type_scan: string }).type_scan !== 'x')));
  });

  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: /Profil & Gaji/ }).nth(1).click();
  await page.getByText('Riwayat Kehadiran').click();

  // navigasi ke Agustus 2026
  for (let i = 0; i < 6 && !(await page.getByText('Agustus 2026').isVisible().catch(() => false)); i++) {
    await page.getByLabel('Bulan sebelumnya').click();
  }
  await expect(page.getByText('Agustus 2026')).toBeVisible();

  // 3 hari hadir, 2 hari ada catatan (telat + tanpa pulang)
  await expect(page.getByText('Hadir (3)')).toBeVisible();
  await expect(page.getByText('Ada catatan (2)')).toBeVisible();

  // Hari sebelum join (1 Agu = Sabtu, hari kerja) TIDAK dihitung tidak hadir
  await page.getByTitle(/^1 Agustus 2026/).click();
  await expect(page.getByText(/Sebelum tanggal mulai kerja/)).toBeVisible();

  // Minggu (2 Agu 2026) = libur, bukan mangkir
  await page.getByTitle(/^2 Agustus 2026/).click();
  await expect(page.getByText(/Minggu.*libur/)).toBeVisible();

  // 8 Agu (Sabtu, sudah lewat, setelah join & effective_from, tanpa scan) = tidak hadir
  await page.getByTitle(/^8 Agustus 2026/).click();
  await expect(page.getByText(/Hari kerja tanpa scan.*tidak hadir/)).toBeVisible();

  // Kolom "Jenis Scan" di tabel log menampilkan masuk/pulang (dulu kosong: bug att.type)
  await expect(page.getByRole('cell', { name: 'masuk' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'pulang' }).first()).toBeVisible();
});
