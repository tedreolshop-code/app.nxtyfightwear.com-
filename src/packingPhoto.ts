// Foto dokumentasi barang keluar, diambil karyawan packing saat menyelesaikan tugas
// packing (bukti fisik terakhir sebelum barang dikirim). Disimpan di Supabase Storage.
// Kalau cloud tidak aktif (VITE_SUPABASE_* kosong), upload dilewati (tidak ada tempat aman
// menyimpan file besar di localStorage).
import { getSupabaseClient, isCloudEnabled } from './cloudSync';

const BUCKET = 'delivery-photos';
export const PHOTO_DELETE_WINDOW_DAYS = 14;

export const uploadPackingPhoto = async (orderNumber: string, file: File): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!client || !isCloudEnabled) return null;
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${orderNumber.replace(/\//g, '-')}-${Date.now()}.${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};

export const deletePackingPhoto = async (photoUrl: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;
  const path = photoUrl.split(`/${BUCKET}/`)[1];
  if (!path) return;
  await client.storage.from(BUCKET).remove([path]);
};

export const canDeletePhoto = (uploadedAt: string | undefined): boolean => {
  if (!uploadedAt) return false;
  const ageMs = Date.now() - new Date(uploadedAt).getTime();
  return ageMs <= PHOTO_DELETE_WINDOW_DAYS * 86400000;
};
