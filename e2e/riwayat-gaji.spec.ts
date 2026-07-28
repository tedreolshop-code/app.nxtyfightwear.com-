import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// Dua kali edit Asep: naik rate + bonus, lalu naik status kepegawaian.
// Audit entry ketiga hanya mengubah foto — tidak boleh muncul sebagai perubahan gaji.
const seed = async (page: Page) => {
  await isolateAsOwner(page); // tanpa ini, tarikan Supabase menimpa seed dan klik tes mengubah data nyata
  await page.addInitScript(() => {
    const base = { id: 'emp-asep', name: 'Asep Saputra', department_id: 'dept-eva-foam', role: 'karyawan' };
    localStorage.setItem('nxty_audit_logs', JSON.stringify([
      {
        id: 'a3', timestamp: '2026-07-20T09:00:00+07:00', actor_name: 'H. Ari Gunawan', actor_role: 'owner',
        action: 'update', entity_type: 'employees', entity_id: 'emp-asep', description: 'ganti foto',
        metadata: { before: { ...base, photo_url: 'x', rate_harian: 165000 }, after: { ...base, photo_url: 'y', rate_harian: 165000 } },
      },
      {
        id: 'a2', timestamp: '2026-07-15T14:30:00+07:00', actor_name: 'H. Ari Gunawan', actor_role: 'owner',
        action: 'update', entity_type: 'employees', entity_id: 'emp-asep', description: 'naik gaji',
        metadata: {
          before: { ...base, rate_harian: 150000, default_live_tiktok_bonus: 20000, employment_status: 'training' },
          after: { ...base, rate_harian: 165000, default_live_tiktok_bonus: 25000, employment_status: 'karyawan' },
        },
      },
      {
        id: 'a1', timestamp: '2026-06-02T10:00:00+07:00', actor_name: 'Siti Rahma', actor_role: 'admin_penjualan',
        action: 'update', entity_type: 'employees', entity_id: 'emp-budi', description: 'karyawan lain',
        metadata: { before: { ...base, rate_harian: 140000 }, after: { ...base, rate_harian: 150000 } },
      },
    ]));
  });
};

const bukaRiwayat = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('row', { name: /Asep Saputra/ }).getByRole('button', { name: /Profil & Gaji/ }).click();
  await page.getByRole('button', { name: /Riwayat Perubahan Gaji/ }).click();
};

test('riwayat perubahan gaji menampilkan tanggal, pelaku, dan nilai sebelum/sesudah', async ({ page }) => {
  await seed(page);
  await bukaRiwayat(page);

  // Hanya satu entri: edit foto tidak dihitung, karyawan lain tidak bocor ke sini
  await expect(page.getByRole('button', { name: 'Riwayat Perubahan Gaji (1)' })).toBeVisible();

  const entri = page.locator('ol > li');
  await expect(entri).toHaveCount(1);
  await expect(entri).toContainText('15 Jul 2026');
  await expect(entri).toContainText('oleh H. Ari Gunawan');
  await expect(entri).toContainText('Rate harian');
  await expect(entri).toContainText('Rp 150.000');
  await expect(entri).toContainText('Rp 165.000');
  await expect(entri).toContainText('Bonus Live TikTok');
  await expect(entri).toContainText('Status kepegawaian');
  await expect(entri).toContainText('Training');
  await expect(entri).toContainText('Karyawan');
});

test('karyawan tanpa perubahan gaji menampilkan pesan kosong', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();
  await page.getByRole('row', { name: /Dewi Lestari/ }).getByRole('button', { name: /Profil & Gaji/ }).click();
  await page.getByRole('button', { name: /Riwayat Perubahan Gaji/ }).click();

  await expect(page.getByText('Belum ada perubahan gaji tercatat')).toBeVisible();
});

// Bukti alur nyata: edit gaji lewat UI harus langsung memunculkan entri riwayat
test('edit tarif lewat form Karyawan langsung tercatat di riwayat hari itu juga', async ({ page }) => {
  await isolateAsOwner(page); // audit ditulis ke localStorage tes, bukan ke Supabase
  page.on('dialog', d => d.accept());
  await page.goto('/');
  await page.locator('#nav-tab-karyawan').click();

  // Sebelum diedit: belum ada jejak sama sekali
  await page.getByRole('row', { name: /Asep Saputra/ }).getByRole('button', { name: /Profil & Gaji/ }).click();
  await expect(page.getByRole('button', { name: 'Riwayat Perubahan Gaji (0)' })).toBeVisible();
  await page.getByRole('button', { name: 'Tutup Portal' }).click();

  // Naikkan tarif harian 150.000 -> 165.000 lewat tombol Edit
  await page.getByRole('row', { name: /Asep Saputra/ }).getByRole('button', { name: 'Edit data karyawan' }).click();
  const tarif = page.locator('input[type="number"]').first();
  await tarif.fill('165000');
  await page.getByRole('button', { name: 'Simpan Perubahan' }).click();

  // Jejaknya muncul seketika, bertanggal hari ini
  await page.getByRole('row', { name: /Asep Saputra/ }).getByRole('button', { name: /Profil & Gaji/ }).click();
  await page.getByRole('button', { name: 'Riwayat Perubahan Gaji (1)' }).click();

  const hariIni = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const entri = page.locator('ol > li');
  await expect(entri).toContainText(hariIni);
  await expect(entri).toContainText('oleh H. Ari Gunawan');
  await expect(entri).toContainText('Rate harian');
  await expect(entri).toContainText('Rp 150.000');
  await expect(entri).toContainText('Rp 165.000');
});
