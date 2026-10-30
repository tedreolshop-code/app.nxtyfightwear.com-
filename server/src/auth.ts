/**
 * Replika RPC Supabase (supabase/auth-hapus-bagian1.sql) di Worker:
 * ari_login / ari_logout / ari_delete_rows / ari_clear_table.
 *
 * Sifat dijaga persis:
 * - PIN diverifikasi SERVER (hash disimulasikan sama dengan hashPin() di src/dataStore.ts).
 * - Rate limit 8x gagal per username per 15 menit.
 * - Hapus wajib token sesi (30 hari) dengan role owner/admin_penjualan/admin_gudang.
 * - Whitelist tabel: ari_store & tabel internal tidak pernah bisa dihapus lewat sini.
 * - Guard hapus massal cermin supabase/guard-mass-delete.sql: >8 baris DAN >25% isi
 *   tabel ditolak.
 */

import { Env, ApiResult, ok, fail } from './cf';
import { DELETABLE_TABLES } from './tables';

const SESSION_DAYS = 30;
const LOGIN_MAX_FAILS = 8;
const LOGIN_WINDOW_MIN = 15;
const ALLOWED_ROLES = new Set(['owner', 'admin_penjualan', 'admin_gudang']);
const MASS_DELETE_MAX_ROWS = 8;
const MASS_DELETE_MAX_RATIO = 0.25;
const DELETE_CHUNK = 200;
const nowIso = (): string => new Date().toISOString();

/** Tiruan hashPin() dari src/dataStore.ts — bit-sama (int32 per langkah). */
export const hashPin = (pin: string): string => {
  if (!pin) return '';
  let h = 0;
  for (let i = 0; i < pin.length; i++) {
    h = (h << 5) - h + pin.charCodeAt(i);
    h |= 0;
  }
  return `sha256_sim_${Math.abs(h)}`;
};

const randomToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
};

/** Role sesi yang masih berlaku, atau null. */
const sessionRole = async (env: Env, token: string): Promise<string | null> => {
  if (!token || token.length > 128) return null;
  const row = await env.DB.prepare('SELECT role FROM ari_sessions WHERE token = ? AND expires_at > ?')
    .bind(token, nowIso())
    .first<{ role: string }>();
  return row?.role ?? null;
};

export const handleLogin = async (env: Env, body: Record<string, unknown>): Promise<ApiResult> => {
  const username = String(body.p_username ?? '').trim().toLowerCase();
  const pin = String(body.p_pin ?? '');
  // Tanpa PIN/username — kembalikan kosong (kegagalan), bukan error.
  if (!username || !pin) return ok(null);

  const cutoff = new Date(Date.now() - LOGIN_WINDOW_MIN * 60000).toISOString();
  const failRow = await env.DB.prepare(
    'SELECT COUNT(*) AS c FROM ari_login_attempts WHERE identifier = ? AND sukses = 0 AND at > ?'
  ).bind(username, cutoff).first<{ c: number }>();
  if (Number(failRow?.c ?? 0) >= LOGIN_MAX_FAILS) return ok(null);

  const hash = hashPin(pin);
  const emp = await env.DB.prepare(
    `SELECT id, value FROM ari_employees
      WHERE lower(json_extract(value, '$.username')) = ?
        AND lower(coalesce(json_extract(value, '$.status_aktif'), 'true')) IN ('true', '1')
        AND (json_extract(value, '$.pin') = ? OR json_extract(value, '$.pin') = ?)
      LIMIT 1`
  ).bind(username, hash, pin).first<{ id: string; value: string }>();

  if (!emp) {
    await env.DB.prepare('INSERT INTO ari_login_attempts (identifier, at, sukses) VALUES (?, ?, 0)')
      .bind(username, nowIso()).run();
    return ok(null);
  }
  await env.DB.prepare('INSERT INTO ari_login_attempts (identifier, at, sukses) VALUES (?, ?, 1)')
    .bind(username, nowIso()).run();

  let nama = '';
  let role = '';
  try {
    const v = JSON.parse(emp.value) as Record<string, unknown>;
    nama = String(v.name ?? '');
    role = String(v.access_role ?? '');
  } catch { /* nilai rusak → nama/role kosong */ }

  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  const token = randomToken();
  await env.DB.prepare(
    'INSERT INTO ari_sessions (token, employee_id, username, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(token, emp.id, username, role, nowIso(), expiresAt).run();

  return ok({ token, employee_id: emp.id, nama, role, expires_at: expiresAt });
};

export const handleLogout = async (env: Env, body: Record<string, unknown>): Promise<ApiResult> => {
  const token = String(body.p_token ?? '');
  if (token) await env.DB.prepare('DELETE FROM ari_sessions WHERE token = ?').bind(token).run();
  return ok(null);
};

/** Verifikasi sesi + role + tabel untuk jalur hapus. Mengembalikan null bila sah. */
const deleteAccessError = async (env: Env, pTable: unknown, pToken: unknown): Promise<string | null> => {
  const table = String(pTable ?? '');
  if (!DELETABLE_TABLES.includes(table)) {
    return `Tabel ${table || '(kosong)'} tidak diizinkan untuk dihapus.`;
  }
  const role = await sessionRole(env, String(pToken ?? ''));
  if (!role) {
    return 'Sesi tidak valid atau sudah kedaluwarsa. Masuk ulang untuk menghapus data.';
  }
  if (!ALLOWED_ROLES.has(role)) {
    return 'Akses Anda tidak diizinkan menghapus data.';
  }
  return null;
};

/** Guard cermin trigger hapus massal — bypass HANYA lewat sini (role diperiksa di atas). */
const massDeleteError = async (env: Env, table: string, ids: unknown): Promise<string | null> => {
  if (!Array.isArray(ids) || ids.length <= MASS_DELETE_MAX_ROWS) return null;
  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM ${table}`)
    .first<{ c: number }>();
  const total = Number(countRow?.c ?? 0);
  if (total > 0 && ids.length > total * MASS_DELETE_MAX_RATIO + 0.5) {
    return `Hapus massal ditolak: ${ids.length} dari ${total} baris "${table}" terlalu banyak untuk satu operasi.`;
  }
  return null;
};

export const handleDeleteRows = async (env: Env, body: Record<string, unknown>): Promise<ApiResult> => {
  const table = String(body.p_table ?? '');
  const ids = Array.isArray(body.p_ids) ? body.p_ids.filter(x => typeof x === 'string') as string[] : [];
  const accessErr = await deleteAccessError(env, body.p_table, body.p_token);
  if (accessErr) return fail(accessErr);
  if (ids.length === 0) return ok(0);

  const massErr = await massDeleteError(env, table, ids);
  if (massErr) return fail(massErr);

  let jumlah = 0;
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_CHUNK);
    const placeholders = chunk.map(() => '?').join(',');
    const res = await env.DB.prepare(`DELETE FROM ${table} WHERE id IN (${placeholders})`)
      .bind(...chunk)
      .run();
    jumlah += Number(res.meta?.changes ?? 0);
  }
  return ok(jumlah);
};

export const handleClearTable = async (env: Env, body: Record<string, unknown>): Promise<ApiResult> => {
  const accessErr = await deleteAccessError(env, body.p_table, body.p_token);
  if (accessErr) return fail(accessErr);
  const table = String(body.p_table ?? '');
  const res = await env.DB.prepare(`DELETE FROM ${table}`).run();
  return ok(Number(res.meta?.changes ?? 0));
};
