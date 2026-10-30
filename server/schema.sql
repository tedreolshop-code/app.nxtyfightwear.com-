-- ============================================================
-- Schema D1 (SQLite) ARI SPORTINDO — pengganti supabase/setup.sql.
-- Jalankan: cd server && npx wrangler d1 execute ari-store --remote --file schema.sql
-- Aman dijalankan berulang (IF NOT EXISTS).
-- ============================================================
-- Bentuk tabel data mengikuti pola Supabase:
--   per-row: id TEXT PRIMARY KEY, value TEXT (JSON), updated_at TEXT (ISO dari jam penulis)
--   absensi: id, value, created_at (ISO — dipakai watermark tarik bertahap)
--   store  : key TEXT PRIMARY KEY, value, updated_at

CREATE TABLE IF NOT EXISTS ari_store (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ari_attendance (
  id         TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ari_attendance_created_at_idx ON ari_attendance (created_at);

-- ---------- Sesi & percobaan login (cermin auth-hapus-bagian1.sql) ----------
CREATE TABLE IF NOT EXISTS ari_sessions (
  token       TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  username    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT '',
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ari_sessions_employee_idx ON ari_sessions (employee_id);
CREATE INDEX IF NOT EXISTS ari_sessions_expires_idx ON ari_sessions (expires_at);

CREATE TABLE IF NOT EXISTS ari_login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  at         TEXT NOT NULL DEFAULT '',
  sukses     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ari_login_attempts_idx ON ari_login_attempts (identifier, at DESC);

-- ---------- Tabel per-baris ----------
CREATE TABLE IF NOT EXISTS ari_employees (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_departments (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_customers (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_assets (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_products (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_raw_materials (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_stock_movements (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_orders (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_marketplace_sales (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_marketplace_item_sales (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_invoices (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_delivery_notes (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_returns (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_production_jobs (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_production_handoffs (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_rejected_goods (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_production_task_logs (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_production_logs (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_packing_tasks (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_purchases (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_daily_expenses (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_payroll_weekly (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_cash_advances (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_cash_advance_transactions (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_attendance_bonus_payouts (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_attendance_adjustments (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_attendance_failures (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS ari_notifications (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');

-- Index updated_at untuk tarik bertahap per tabel (uyumlah baris kecil, tapi murah).
CREATE INDEX IF NOT EXISTS ari_employees_upd_idx ON ari_employees (updated_at);
CREATE INDEX IF NOT EXISTS ari_orders_upd_idx ON ari_orders (updated_at);
CREATE INDEX IF NOT EXISTS ari_packing_tasks_upd_idx ON ari_packing_tasks (updated_at);
CREATE INDEX IF NOT EXISTS ari_marketplace_item_sales_upd_idx ON ari_marketplace_item_sales (updated_at);
