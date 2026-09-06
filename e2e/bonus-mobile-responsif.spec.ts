import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

test.use({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });

const SHOT_DIR = 'test-results/bonus-mobile';

/**
 * Menu Bonus Kehadiran di viewport HP wajib responsif sepenuhnya:
 * - tidak ada scroll horizontal pada halaman;
 * - tidak ada tabel/konten yang harus digeser ke samping untuk terbaca
 *   (menu bar atas memang sengaja scroll-x, di-whitelist);
 * - tidak ada elemen yang ujungnya keluar layar (kepotong).
 * Screenshot tiap sub-tab disimpan ke test-results/bonus-mobile/ untuk dicek mata.
 */
const seed = async (page: Page) => {
  await isolateAsOwner(page);
  await page.addInitScript(() => {
    const base = { department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 100000, rate_lembur_per_jam: 10000,
      default_attendance_bonus: 300000, status_aktif: true, phone_number: '08', pin: 'x', pin_hashed: false };
    localStorage.setItem('nxty_employees', JSON.stringify([
      { ...base, id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', access_role: 'owner' },
      { ...base, id: 'emp-a', username: 'siti', name: 'Siti Rahma' },
      { ...base, id: 'emp-b', username: 'dewi', name: 'Dewi Lestari' },
    ]));
    localStorage.setItem('nxty_attendance_bonus_payouts', JSON.stringify([
      { id: 'bonus-2026-07-emp-a', employee_id: 'emp-a', employee_name: 'Siti Rahma', month: '2026-07', amount: 6300000,
        status: 'cair', working_days: 26, present_days: 26, late_minutes_net: 0, half_days: 0,
        issued_at: '2026-08-01T08:00:00+07:00', payment_status: 'unpaid' },
      { id: 'bonus-2026-07-emp-b', employee_id: 'emp-b', employee_name: 'Dewi Lestari', month: '2026-07', amount: 0,
        status: 'gugur', reason: 'Telat 3 hari', working_days: 26, present_days: 24, late_minutes_net: 45, half_days: 1,
        issued_at: '2026-08-01T08:00:00+07:00', payment_status: 'unpaid' },
      { id: 'bonus-2026-06-emp-a', employee_id: 'emp-a', employee_name: 'Siti Rahma', month: '2026-06', amount: 6000000,
        status: 'cair', working_days: 25, present_days: 25, late_minutes_net: 0, half_days: 0,
        issued_at: '2026-07-01T08:00:00+07:00', payment_status: 'paid', paid_at: '2026-07-02T10:00:00+07:00' },
    ]));
  });
};

const bukaBonus = async (page: Page) => {
  await page.goto('/');
  await page.locator('div.md\\:hidden.flex.overflow-x-auto > button', { hasText: 'Karyawan' }).click();
  await page.getByRole('button', { name: 'Payroll & Slip Gaji' }).click();
  await page.getByRole('button', { name: 'Bonus Kehadiran' }).click();
};

// Perluas area scroll utama sementara supaya screenshot fullPage menangkap
// seluruh konten (di layar sungguhan area ini yang di-scroll ke dalam).
const expandScroller = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('main > div.overflow-y-auto') as HTMLElement | null;
    if (!el) return;
    for (let a: HTMLElement | null = el; a && a !== document.body; a = a.parentElement) {
      a.style.height = 'auto';
      a.style.maxHeight = 'none';
      a.style.overflow = 'visible';
    }
  });

const detectKepotong = (page: Page) =>
  page.evaluate(() => {
    const vw = window.innerWidth;
    const out = { scroll: [] as string[], scrollableContainer: [] as string[], hard: [] as string[] };
    // Semua container scroll-x: menu bar atas memang sengaja bisa digeser,
    // tabel konten TIDAK — wajib muat (scrollWidth ≈ clientWidth).
    document.querySelectorAll('*').forEach(el => {
      const elc = el as HTMLElement;
      if (elc.scrollWidth > elc.clientWidth + 2 && getComputedStyle(elc).overflowX !== 'visible') {
        const isNavBar = elc.className && String(elc.className).includes('md:hidden');
        if (!isNavBar && out.scrollableContainer.length < 8) {
          out.scrollableContainer.push(`overflow-x: scrollW=${elc.scrollWidth} clientW=${elc.clientWidth} <${elc.tagName.toLowerCase()} class="${String(elc.className).slice(0, 60)}">`);
        }
      }
    });
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // Elemen di dalam menu bar atas (sengaja scroll-x) di-skip; sidebar
      // desktop off-canvas (sepenuhnya di kiri luar layar) juga bukan bug.
      let diMenuBar = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (String(a.className).includes('md:hidden')) { diMenuBar = true; break; }
      }
      if (diMenuBar) return;
      const keluarKanan = r.left < vw && r.right > vw + 2;
      const keluarKiri = r.right > 0 && r.left < -2;
      if (!keluarKanan && !keluarKiri) return;
      const txt = (el.textContent || '').trim().slice(0, 50).replace(/\s+/g, ' ');
      const desc = `${el.tagName.toLowerCase()} "${txt}" right=${Math.round(r.right)} left=${Math.round(r.left)} vw=${vw}`;
      if (out.hard.length < 12) out.hard.push(desc);
    });
    return out;
  });

test('Bonus Kehadiran mobile: tidak ada elemen kepotong di layar 393px & 360px', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await seed(page);

  // Dua ukuran layar: Android normal (393) dan layar kecil (360).
  for (const [vp, vpLabel] of [[{ width: 393, height: 851 }, 'pixel5'], [{ width: 360, height: 780 }, 'layar-kecil']] as const) {
    await page.setViewportSize(vp);
    await bukaBonus(page);

    const laporan: Record<string, Awaited<ReturnType<typeof detectKepotong>>> = {};
    const cek = async (label: string) => {
      const overflowX = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      laporan[label] = await detectKepotong(page);
      await expandScroller(page);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${SHOT_DIR}/${vpLabel}-${label}.png`, fullPage: true });
      expect(overflowX, `[${vpLabel}/${label}] halaman scroll ke samping`).toBeLessThanOrEqual(1);
      return laporan[label];
    };

    await cek('1-posisi');
    await page.getByRole('button', { name: /Evaluasi/ }).click();
    await cek('2-evaluasi');
    await page.getByRole('button', { name: /Buku Slip Bonus/ }).click();
    await cek('3-buku-slip-aktif');
    await page.getByRole('button', { name: 'Jumlah (IDR)' }).click();
    await cek('4-buku-slip-sortir');
    await page.locator('table').locator('tbody tr').first().getByTitle('Hapus Slip Bonus').click();
    await cek('5-modal-hapus');
    await page.getByRole('button', { name: 'Batal' }).click();
    await page.getByRole('button', { name: 'Cetak Slip' }).first().click();
    await cek('6-pratinjau-a4');

    console.log(`LAPORAN_KEPOTONG ${vpLabel} ` + JSON.stringify(laporan, null, 1));
    // "hard" = elemen terpotong permanen; "scrollableContainer" = konten yang
    // baru terlihat setelah digeser ke samping (menu bar di-whitelist) → dua-duanya wajib kosong.
    for (const [label, r] of Object.entries(laporan)) {
      expect(r.hard, `[${vpLabel}/${label}] elemen terpotong permanen:\n${r.hard.join('\n')}`).toEqual([]);
      expect(r.scrollableContainer, `[${vpLabel}/${label}] konten masih harus digeser ke samping:\n${r.scrollableContainer.join('\n')}`).toEqual([]);
    }
  }
});
