/**
 * Sesi cloud (token) untuk operasi hapus.
 *
 * Policy DELETE di database sudah dicabut (lihat supabase/auth-hapus-bagian2-cutover.sql),
 * jadi menghapus data hanya sah lewat RPC yang memeriksa token ini. Token didapat
 * dari ari_login(), yang memverifikasi PIN di server — bukan lagi hanya di klien.
 *
 * Modul ini sengaja TIDAK mengimpor apa pun supaya cloudSync bisa memakainya
 * tanpa impor melingkar (cloudSync yang memiliki klien Supabase).
 */

const TOKEN_KEY = 'nxty_cloud_token';

export const getCloudToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const setCloudToken = (token: string): void => {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage penuh: abaikan */ }
};

export const clearCloudToken = (): void => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* abaikan */ }
};
