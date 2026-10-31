-- Optimasi kuota baca D1 — jalankan sekali (aman berulang):
--   cd server && npx wrangler d1 execute ari-store --remote --file optimize.sql -y
-- 1) Stamp per tabel untuk /api/version (klien skip tarik kalau tak berubah).
-- 2) Index updated_at semua tabel per-baris → poll bertahap cuma baca baris baru.
-- 3) Index ekspresi timestamp absensi → poll monitoring 60s baca ≈ 0 baris.

CREATE TABLE IF NOT EXISTS ari_sync_state (
  table_name TEXT PRIMARY KEY,
  stamp      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ari_attendance_ts_expr_idx
  ON ari_attendance (json_extract(value, '$.timestamp'));

CREATE INDEX IF NOT EXISTS ari_employees_upd_idx ON ari_employees (updated_at);
CREATE INDEX IF NOT EXISTS ari_departments_upd_idx ON ari_departments (updated_at);
CREATE INDEX IF NOT EXISTS ari_customers_upd_idx ON ari_customers (updated_at);
CREATE INDEX IF NOT EXISTS ari_assets_upd_idx ON ari_assets (updated_at);
CREATE INDEX IF NOT EXISTS ari_products_upd_idx ON ari_products (updated_at);
CREATE INDEX IF NOT EXISTS ari_raw_materials_upd_idx ON ari_raw_materials (updated_at);
CREATE INDEX IF NOT EXISTS ari_stock_movements_upd_idx ON ari_stock_movements (updated_at);
CREATE INDEX IF NOT EXISTS ari_orders_upd_idx ON ari_orders (updated_at);
CREATE INDEX IF NOT EXISTS ari_marketplace_sales_upd_idx ON ari_marketplace_sales (updated_at);
CREATE INDEX IF NOT EXISTS ari_marketplace_item_sales_upd_idx ON ari_marketplace_item_sales (updated_at);
CREATE INDEX IF NOT EXISTS ari_invoices_upd_idx ON ari_invoices (updated_at);
CREATE INDEX IF NOT EXISTS ari_delivery_notes_upd_idx ON ari_delivery_notes (updated_at);
CREATE INDEX IF NOT EXISTS ari_returns_upd_idx ON ari_returns (updated_at);
CREATE INDEX IF NOT EXISTS ari_production_jobs_upd_idx ON ari_production_jobs (updated_at);
CREATE INDEX IF NOT EXISTS ari_production_handoffs_upd_idx ON ari_production_handoffs (updated_at);
CREATE INDEX IF NOT EXISTS ari_rejected_goods_upd_idx ON ari_rejected_goods (updated_at);
CREATE INDEX IF NOT EXISTS ari_production_task_logs_upd_idx ON ari_production_task_logs (updated_at);
CREATE INDEX IF NOT EXISTS ari_production_logs_upd_idx ON ari_production_logs (updated_at);
CREATE INDEX IF NOT EXISTS ari_packing_tasks_upd_idx ON ari_packing_tasks (updated_at);
CREATE INDEX IF NOT EXISTS ari_purchases_upd_idx ON ari_purchases (updated_at);
CREATE INDEX IF NOT EXISTS ari_daily_expenses_upd_idx ON ari_daily_expenses (updated_at);
CREATE INDEX IF NOT EXISTS ari_payroll_weekly_upd_idx ON ari_payroll_weekly (updated_at);
CREATE INDEX IF NOT EXISTS ari_cash_advances_upd_idx ON ari_cash_advances (updated_at);
CREATE INDEX IF NOT EXISTS ari_cash_advance_transactions_upd_idx ON ari_cash_advance_transactions (updated_at);
CREATE INDEX IF NOT EXISTS ari_attendance_bonus_payouts_upd_idx ON ari_attendance_bonus_payouts (updated_at);
CREATE INDEX IF NOT EXISTS ari_attendance_adjustments_upd_idx ON ari_attendance_adjustments (updated_at);
CREATE INDEX IF NOT EXISTS ari_attendance_failures_upd_idx ON ari_attendance_failures (updated_at);
CREATE INDEX IF NOT EXISTS ari_notifications_upd_idx ON ari_notifications (updated_at);
CREATE INDEX IF NOT EXISTS ari_store_upd_idx ON ari_store (updated_at);
