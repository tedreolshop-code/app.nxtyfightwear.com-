// Foto dokumentasi barang keluar, diambil karyawan packing saat menyelesaikan tugas
// packing (bukti fisik terakhir sebelum barang dikirim). Disimpan di R2 Cloudflare
// lewat Worker API (server/src/photos.ts).
// Kalau cloud tidak aktif (VITE_API_BASE_URL kosong), upload dilewati (tidak ada tempat
// aman menyimpan file besar di localStorage).
import { photoApi } from './cloudApi';
import { isCloudEnabled } from './cloudSync';

export const PHOTO_DELETE_WINDOW_DAYS = 14;

export const uploadPackingPhoto = async (orderNumber: string, file: File): Promise<string | null> => {
  if (!isCloudEnabled) return null;
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${orderNumber.replace(/\//g, '-')}-${Date.now()}.${ext}`;
  const { url, error } = await photoApi.upload(path, file);
  if (error) throw new Error(error);
  return url;
};

export const deletePackingPhoto = async (photoUrl: string): Promise<void> => {
  if (!isCloudEnabled) return;
  // URL foto bisa dua bentuk: domain publik R2 (https://cdn/<key>) atau lewat
  // Worker (/api/photo/<key>). Keduanya: kunci = segmen path terakhir.
  const key = decodeURIComponent(photoUrl.split('?')[0].split('/').pop() || '');
  if (!key) return;
  const error = await photoApi.remove(key);
  if (error) throw new Error(error);
};

export const canDeletePhoto = (uploadedAt: string | undefined): boolean => {
  if (!uploadedAt) return false;
  const ageMs = Date.now() - new Date(uploadedAt).getTime();
  return ageMs <= PHOTO_DELETE_WINDOW_DAYS * 86400000;
};
