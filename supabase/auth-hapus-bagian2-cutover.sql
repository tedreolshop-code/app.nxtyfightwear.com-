-- ============================================================
-- BAGIAN 2 — CUTOVER: cabut semua policy DELETE.
-- ============================================================
--
-- !!! JANGAN jalankan sebelum ketiganya terpenuhi !!!
--   1. auth-hapus-bagian1.sql sudah dijalankan.
--   2. Klien baru (yang menghapus lewat RPC ber-token) sudah di-deploy.
--   3. Perangkat sudah login sampai ada baris di public.ari_sessions.
--
-- Kalau dijalankan terlalu cepat: perangkat lama (masih memakai delete langsung)
-- akan berhenti bisa menghapus. Data TIDAK hilang — perintah hapusnya hanya tidak
-- menghapus apa pun (RLS menyaring), dan baris yang terlanjur dihapus di perangkat
-- akan muncul lagi setelah sinkron.
--
-- Setelah berkas ini, RLS menolak SEMUA penghapusan langsung dari anon maupun
-- authenticated. Penghapusan hanya bisa lewat public.ari_delete_rows() dan
-- public.ari_clear_table() dari Bagian 1, yang memverifikasi PIN di server dan
-- membatasi peran ke owner/admin.
--
-- Aman dijalankan berulang.

do $$
declare
  t text;
begin
  foreach t in array array[
    'ari_store', 'ari_attendance',
    'ari_departments', 'ari_customers', 'ari_assets',
    'ari_employees', 'ari_products', 'ari_raw_materials', 'ari_stock_movements',
    'ari_orders', 'ari_marketplace_sales', 'ari_marketplace_item_sales',
    'ari_invoices', 'ari_delivery_notes', 'ari_returns',
    'ari_production_jobs', 'ari_production_handoffs', 'ari_rejected_goods',
    'ari_production_task_logs', 'ari_production_logs', 'ari_packing_tasks',
    'ari_purchases', 'ari_daily_expenses',
    'ari_payroll_weekly', 'ari_cash_advances', 'ari_cash_advance_transactions',
    'ari_attendance_bonus_payouts', 'ari_attendance_adjustments',
    'ari_attendance_failures', 'ari_notifications'
  ] loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      -- Nama policy delete dibuat oleh supabase/setup.sql dengan pola "<tabel>_delete".
      execute format('drop policy if exists "%s_delete" on public.%I', t, t);
    end if;
  end loop;
end $$;

-- ---------- Verifikasi Bagian 2 ----------
-- 1. HARUS kosong: tidak boleh ada policy DELETE di schema public lagi.
select tablename, policyname
from pg_policies
where schemaname = 'public' and cmd = 'DELETE'
order by 1;

-- 2. Uji dari aplikasi/perangkat (anon): perintah ini harus TIDAK menghapus apa pun
--    (tanpa error, 0 baris terpengaruh):
--      delete from public.ari_employees;
--    Sedangkan lewat RPC dengan sesi owner tetap harus jalan:
--      select public.ari_delete_rows('ari_employees', array['id-uji'], '<token>');
--
-- 3. Cara mengembalikan bila ada masalah (ROLLBACK):
--    create policy "ari_employees_delete" on public.ari_employees for delete using (true);
--    -- ...ulangi untuk tabel lain bila perlu.
