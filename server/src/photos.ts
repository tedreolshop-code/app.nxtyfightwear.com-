/**
 * Foto dokumentasi pengiriman di R2 — pengganti bucket Supabase
 * 'delivery-photos' (src/packingPhoto.ts).
 *
 * - /api/photo (POST): upload multipart. Field "key" = nama file (flat, tanpa
 *   folder), "file" = berkas. Server mengembalikan URL publik.
 * - /api/photo/<key> (GET): serve berkas — dipakai otomatis bila R2_PUBLIC_URL
 *   belum diikinkan ke domain publik (domain publik lebih hemat requests).
 * - /api/photo (DELETE): hapus per key — windows 14 hari dikontrol sisi klien.
 *
 * Paritas dengan Supabase Storage: upload/serve publik tanpa kredensial.
 * (Peringatan: apa pun yang punya URL bisa mengunggah — sama seperti bucket
 * publik sebelumnya; pembatasan menyusul bila dibutuhkan.)
 */

import { Env, ApiResult, ok, fail } from './cf';

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const DEFAULT_CONTENT_TYPE = 'image/jpeg';
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const publicUrl = (env: Env, key: string, origin: string): string => {
  // WAJIB absolut: URL ini disimpan ke database oleh klien (vercel/cloud lain),
  // jadi bila R2_PUBLIC_URL belum diisi, pakai origin Worker dari request.
  const base = env.R2_PUBLIC_URL ? env.R2_PUBLIC_URL.replace(/\/+$/, '') : origin;
  return `${base}/api/photo/${key}`;
};

export const handlePhotoUpload = async (env: Env, req: Request): Promise<ApiResult> => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('Upload harus multipart/form-data.');
  }
  const keyRaw = form.get('key');
  const file = form.get('file');
  if (typeof keyRaw !== 'string' || !KEY_RE.test(keyRaw)) return fail('Nama foto tidak valid.');
  if (!(file instanceof File)) return fail('Berkas foto tidak ada.');
  if (file.size <= 0) return fail('Berkas kosong.');
  if (file.size > MAX_UPLOAD_BYTES) return fail('Berkas terlalu besar (maksimum 15 MB).');

  const content = await file.arrayBuffer();
  await env.PHOTOS.put(keyRaw, content, {
    httpMetadata: { contentType: file.type || DEFAULT_CONTENT_TYPE },
  });
  const origin = new URL(req.url).origin;
  return ok({ url: publicUrl(env, keyRaw, origin), key: keyRaw });
};

/** GET /api/photo/<key> — serve berkas langsung dari R2. */
export const servePhoto = async (env: Env, key: string): Promise<Response> => {
  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response('Tidak ditemukan', { status: 404 });
  const headers = new Headers({
    'content-type': obj.httpMetadata?.contentType || DEFAULT_CONTENT_TYPE,
    'cache-control': 'public, max-age=86400',
  });
  return new Response(obj.body, { headers });
};

export const handlePhotoDelete = async (env: Env, body: Record<string, unknown>): Promise<ApiResult> => {
  let key = String(body.key ?? '');
  if (!key) {
    const url = String(body.url ?? '');
    key = url.split('/').pop() || '';
    if (key.includes('?')) key = key.slice(0, key.indexOf('?'));
    key = decodeURIComponent(key);
  }
  if (!KEY_RE.test(key)) return fail('Nama foto tidak valid.');
  await env.PHOTOS.delete(key);
  return ok({ key });
};
