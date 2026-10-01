import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false });

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const todayWib = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

/** Hari kerja (bukan Minggu) pada 2-7 hari lalu. */
const hariKerja = (() => {
  for (let i = 2; i <= 7; i++) {
    const d = new Date(new Date(`${todayWib}T00:00:00Z`).getTime() - i * 86400000);
    if (d.getUTCDay() !== 0) return d.toISOString().slice(0, 10);
  }
  return todayWib;
})();

/** Hari Minggu terdekat yang sudah lewat (untuk menguji penjagaan hari libur). */
const hariMinggu = (() => {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(new Date(`${todayWib}T00:00:00Z`).getTime() - i * 86400000);
    if (d.getUTCDay() === 0) return d.toISOString().slice(0, 10);
  }
  return todayWib;
})();

/** Label bulan "September 2026" dari tanggal YYYY-MM-DD. */
const labelBulan = (tanggal: string) => {
  const [y, m] = tanggal.split('-').map(Number);
  return `${NAMA_BULAN[m - 1]} ${y}`;
};

const seed = () => {
  localStorage.setItem('nxty_employees', JSON.stringify([
    { id: 'emp-owner', username: 'ari', name: 'Ari Owner', department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 0, rate_lembur_per_jam: 0, status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false, access_role: 'owner' },
    { id: 'emp-uji', username: 'uji', name: 'Budi Uji', department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000, status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false, join_date: '2026-01-01' },
  ]));
  localStorage.setItem('nxty_attendance', JSON.stringify([]));
};

/** Buka kalender kehadiran milik Budi Uji (admin: Data Karyawan → Profil & Gaji). */
const bukaKalenderBudi = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByPlaceholder('Cari nama / username...').fill('Budi');
  await page.getByRole('button', { name: /Profil & Gaji/ }).first().click();
  await page.getByText('Riwayat Kehadiran').click();
};

const bukaBulan = async (page: import('@playwright/test').Page, tanggal: string) => {
  for (let i = 0; i < 3; i++) {
    if (await page.getByText(labelBulan(tanggal)).first().isVisible().catch(() => false)) break;
    await page.getByLabel('Bulan sebelumnya').click();
  }
  await expect(page.getByText(labelBulan(tanggal)).first()).toBeVisible();
};

const klikTanggal = async (page: import('@playwright/test').Page, tanggal: string) => {
  const [y, m, d] = tanggal.split('-').map(Number);
  await page.getByTitle(new RegExp(`^${d} ${NAMA_BULAN[m - 1]} ${y}`)).click();
};

/**
 * Pemilik meminta koreksi bisa dilakukan langsung dengan mengklik tanggal di
 * kalender kehadiran. Tes ini menjaga jalur itu: satu klik → catat scan yang
 * hilang → hari itu langsung bertanda koreksi admin.
 */
test('klik tanggal di kalender bisa mencatat scan yang hilang', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await isolateAsOwner(page);
  await page.addInitScript(seed);

  await bukaKalenderBudi(page);
  await bukaBulan(page, hariKerja);
  await klikTanggal(page, hariKerja);

  const panel = page.getByRole('group', { name: `Koreksi hari ${hariKerja}` });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Belum ada scan sama sekali hari ini.')).toBeVisible();

  await panel.getByLabel(`Alasan koreksi ${hariKerja}`).fill('Gagal scan masuk dan pulang');
  await panel.getByRole('button', { name: 'Simpan Koreksi' }).click();
  await expect(page.getByText('Koreksi tersimpan.')).toBeVisible();

  // Dua baris absensi bertanda koreksi admin terbentuk (masuk + pulang).
  const tercatat = await page.evaluate((tanggal) => {
    const rows = JSON.parse(localStorage.getItem('nxty_attendance') || '[]') as Array<Record<string, unknown>>;
    return rows
      .filter(r => String(r.id).includes(tanggal))
      .map(r => ({ type: r.type_scan, device: r.device_token, metode: r.verification_method }));
  }, hariKerja);
  expect(tercatat.length).toBe(2);
  expect(tercatat.every(r => r.device === 'koreksi-admin' && r.metode === 'admin_qr')).toBe(true);

  // Panel berganti ke mode pembatalan karena hari itu kini berisi koreksi admin
  // (dua baris: masuk & pulang, masing-masing bisa dibatalkan).
  await expect(page.getByRole('button', { name: 'Batalkan Koreksi' })).toHaveCount(2);
});

test('hari Minggu tidak bisa dikoreksi dari kalender', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await isolateAsOwner(page);
  await page.addInitScript(seed);

  await bukaKalenderBudi(page);
  await bukaBulan(page, hariMinggu);
  await klikTanggal(page, hariMinggu);

  await expect(page.getByText('Hari Minggu libur — tidak dihitung.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simpan Koreksi' })).toHaveCount(0);
});
