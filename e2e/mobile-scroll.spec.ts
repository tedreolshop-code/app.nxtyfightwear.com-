import { test, expect, Page } from '@playwright/test';
import { isolateAsOwner } from './isolate';

// Sesi owner disuntik langsung supaya tes tidak bergantung pada UI PIN,
// dan Supabase diblokir supaya tes tidak menyentuh data produksi.
const seedOwnerSession = isolateAsOwner;

/**
 * Area scroll utama: <div class="flex-1 min-h-0 overflow-y-auto"> di dalam <main>.
 * Kalau min-h-0 hilang, div ini memanjang setinggi kontennya dan bagian bawahnya
 * terpotong overflow-hidden induknya — itu bug "tidak bisa scroll ke bawah".
 */
const mainScroller = (page: Page) => page.locator('main > div.overflow-y-auto');

test.describe('viewport HP: konten harus bisa di-scroll sampai bawah', () => {
  test.beforeEach(async ({ page }) => {
    await seedOwnerSession(page);
    await page.goto('/');
    await expect(mainScroller(page)).toBeVisible();
  });

  test('setiap menu bisa di-scroll sampai baris terakhir', async ({ page }) => {
    const menuButtons = page.locator('div.md\\:hidden.flex.overflow-x-auto > button');
    const total = await menuButtons.count();
    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < total; i++) {
      const label = (await menuButtons.nth(i).innerText()).trim();
      await menuButtons.nth(i).click();
      await page.waitForTimeout(150); // beri waktu render menu berat

      const scroller = mainScroller(page);
      const viewportHeight = page.viewportSize()!.height;

      // 1. Area scroll wajib muat di layar. Kalau bawahnya lewat viewport, artinya
      //    dia memanjang mengikuti konten, bukan menyusut lalu scroll di dalam.
      const bottom = await scroller.evaluate(el => el.getBoundingClientRect().bottom);
      expect(bottom, `menu "${label}": area scroll melewati bawah layar`).toBeLessThanOrEqual(viewportHeight + 1);

      // 2. Baris terakhir harus benar-benar bisa dijangkau dengan scroll.
      const reached = await scroller.evaluate(el => {
        el.scrollTop = el.scrollHeight;
        return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      });
      expect(reached, `menu "${label}": tidak sampai ke bagian paling bawah`).toBe(true);

      await scroller.evaluate(el => { el.scrollTop = 0; });
    }
  });

  test('halaman tidak scroll horizontal', async ({ page }) => {
    const overflowX = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX, 'body ikut scroll ke samping').toBeLessThanOrEqual(1);
  });

  test('modal Stock Opname bisa di-scroll sampai tombol posting', async ({ page }) => {
    await page.locator('div.md\\:hidden.flex.overflow-x-auto > button', { hasText: 'Gudang' }).first().click();
    await page.getByRole('button', { name: /Stock Opname/i }).first().click();

    const postButton = page.getByRole('button', { name: /Posting Opname/i });
    await expect(postButton).toBeVisible();
    // Tombol paling bawah modal harus bisa dijangkau, bukan terpotong di luar layar
    await postButton.scrollIntoViewIfNeeded();
    const box = (await postButton.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  });
});
