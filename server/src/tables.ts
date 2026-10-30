/**
 * Daftar tabel D1 — cermin supabase/setup.sql.
 *
 * Semua tabel data memakai bentuk yang sama: (id TEXT PRIMARY KEY, value TEXT
 * (JSON), updated_at TEXT). Kecuali:
 * - ari_store: (key TEXT PRIMARY KEY, value, updated_at) — key/value store.
 * - ari_attendance: (id PRIMARY KEY, value, created_at) — absen per baris.
 */

/** Tabel per-baris (id/value/updated_at) — cermin PER_ROW di src/cloudSync.ts. */
export const ROW_TABLES = [
  'ari_employees', 'ari_departments', 'ari_customers', 'ari_assets',
  'ari_products', 'ari_raw_materials', 'ari_stock_movements',
  'ari_orders', 'ari_marketplace_sales', 'ari_marketplace_item_sales',
  'ari_invoices', 'ari_delivery_notes', 'ari_returns',
  'ari_production_jobs', 'ari_production_handoffs', 'ari_rejected_goods',
  'ari_production_task_logs', 'ari_production_logs', 'ari_packing_tasks',
  'ari_purchases', 'ari_daily_expenses',
  'ari_payroll_weekly', 'ari_cash_advances', 'ari_cash_advance_transactions',
  'ari_attendance_bonus_payouts', 'ari_attendance_adjustments',
  'ari_attendance_failures', 'ari_notifications',
] as const;

/** Semua tabel yang bisa dibaca klien (termasuk ari_store & ari_attendance). */
export const READABLE_TABLES = [...ROW_TABLES, 'ari_attendance', 'ari_store'] as string[];

/** Hapus diizinkan hanya tabel ini — cermin whitelist RPC ari_delete_rows.
 * ari_store & tabel internal sengaja dikecualikan (cantik: hapus bisa meruntuhkan nisan). */
export const DELETABLE_TABLES = [...ROW_TABLES, 'ari_attendance'] as string[];

/** Kolom yang boleh ditulis via /api/upsert, per bentuk tabel. */
export const ROW_UPSERT_COLS = ['id', 'value', 'updated_at', 'created_at'];
export const STORE_UPSERT_COLS = ['key', 'value', 'updated_at'];

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const isSafeIdent = (s: unknown): s is string =>
  typeof s === 'string' && s.length <= 64 && IDENT.test(s);

/** Path JSON 1 tingkat di kolom value (mis. timestamp) — dipakai filter value->>x. */
export const isSafeJsonPath = (s: unknown): s is string =>
  typeof s === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(s) && !/^_/.test(s);
