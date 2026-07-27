import { Page } from '@playwright/test';

/**
 * WAJIB dipakai setiap tes e2e SEBELUM page.goto().
 *
 * .env memuat kredensial Supabase, jadi aplikasi yang dibuka Playwright akan
 * menarik dan MENULIS data produksi sungguhan. Semua permintaan ke Supabase
 * diblokir di sini supaya tes hanya bermain dengan localStorage di browser tes:
 * data seed tidak tertimpa tarikan cloud, dan klik di tes tidak pernah sampai
 * ke database nyata.
 */
export const blockCloudSync = async (page: Page) => {
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).host;
    return host.endsWith('supabase.co') || host.endsWith('supabase.in')
      ? route.abort()
      : route.fallback();
  });
};

/** Isolasi cloud + login sebagai owner tanpa lewat UI PIN. */
export const isolateAsOwner = async (page: Page) => {
  await blockCloudSync(page);
  await page.addInitScript(() => {
    localStorage.setItem('nxty_session', JSON.stringify({
      role: 'owner',
      name: 'H. Ari Gunawan',
      employeeId: 'emp-owner',
    }));
  });
};
