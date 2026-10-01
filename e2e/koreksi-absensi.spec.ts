import { test, expect } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const todayWib = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

/** Tanggal (YYYY-MM-DD) sejumlah hari ke belakang dari hari ini WIB. */
const mundur = (hari: number) =>
  new Date(new Date(`${todayWib}T00:00:00Z`).getTime() - hari * 86400000).toISOString().slice(0, 10);

/**
 * Hari kerja (bukan Minggu) pertama pada rentang hari ke-belakang tertentu.
 * Minggu libur, jadi tes yang memakai tanggal Minggu barisnya tidak akan muncul.
 */
const hariKerjaMundur = (dari: number, sampai: number) => {
  for (let i = dari; i <= sampai; i++) {
    const d = new Date(new Date(`${todayWib}T00:00:00Z`).getTime() - i * 86400000);
    if (d.getUTCDay() !== 0) return d.toISOString().slice(0, 10);
  }
  return '';
};

const dalamJendela = hariKerjaMundur(2, 7);
const diLuarJendela = hariKerjaMundur(8, 14);

/** Seed dua karyawan tanpa catatan absensi sama sekali. */
const seedKaryawanTanpaAbsensi = () => {
  const base = {
    department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
    status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false, join_date: '2026-01-01',
  };
  localStorage.setItem('nxty_employees', JSON.stringify([
    { ...base, id: 'emp-owner', username: 'ari', name: 'Ari Owner', access_role: 'owner' },
    { ...base, id: 'emp-uji', username: 'uji', name: 'Budi Uji' },
  ]));
  localStorage.setItem('nxty_attendance', JSON.stringify([]));
};

const bukaTabKoreksi = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('button', { name: 'Absensi', exact: true }).nth(1).click();
  await page.getByRole('button', { name: 'Riwayat & Pemantauan' }).click();
  await page.getByRole('button', { name: 'Koreksi', exact: true }).click();
};

/**
 * Sebelumnya koreksi hanya bisa untuk scan PULANG yang hilang. Bila karyawan gagal
 * scan MASUK, hari itu dihitung tidak hadir sehingga upah harian dan bonus
 * kehadirannya hilang tanpa jalan perbaikan. Tes ini menjaga jalur koreksinya.
 */
test('koreksi scan masuk tersimpan sebagai absensi bertanda admin dan hilang dari daftar', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await isolateAsOwner(page);
  await page.addInitScript(seedKaryawanTanpaAbsensi);

  await bukaTabKoreksi(page);
  await expect(page.getByText('Belum Ada Scan Masuk')).toBeVisible();

  const nama = `Koreksi masuk Budi Uji ${dalamJendela}`;
  const row = page.getByRole('group', { name: nama });
  await expect(row).toBeVisible();
  await row.getByLabel('Alasan koreksi masuk').fill('Gagal scan saat datang');
  await row.getByRole('button', { name: 'Catat Masuk' }).click();

  await expect(page.getByText(`Koreksi masuk Budi Uji ${dalamJendela} berhasil disimpan.`)).toBeVisible();

  // Tersimpan sebagai absensi bertanda koreksi admin, bukan scan asli karyawan.
  const tersimpan = await page.evaluate((tanggal) => {
    const logs = JSON.parse(localStorage.getItem('nxty_attendance') || '[]') as Array<Record<string, unknown>>;
    return logs.find(l => l.id === `att-emp-uji-${tanggal}-masuk`) || null;
  }, dalamJendela);
  expect(tersimpan).not.toBeNull();
  expect(tersimpan!.verification_method).toBe('admin_qr');
  expect(tersimpan!.device_token).toBe('koreksi-admin');
  expect(tersimpan!.type_scan).toBe('masuk');

  // Setelah punya scan masuk, baris itu tidak lagi menunggu dikoreksi.
  await expect(page.getByRole('group', { name: nama })).toHaveCount(0);
});

test('daftar koreksi hanya memuat 7 hari terakhir', async ({ page }) => {
  await isolateAsOwner(page);
  await page.addInitScript(seedKaryawanTanpaAbsensi);

  await bukaTabKoreksi(page);

  await expect(page.getByRole('group', { name: `Koreksi masuk Budi Uji ${dalamJendela}` })).toBeVisible();
  // Lebih tua dari jendela koreksi: tidak pernah ditawarkan.
  await expect(page.getByRole('group', { name: `Koreksi masuk Budi Uji ${diLuarJendela}` })).toHaveCount(0);
});
