-- ============================================================
-- Pengaman hapus massal di sisi DATABASE (backstop server).
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman diulang.
-- ============================================================
--
-- Latar: insiden 29 Sep 2026 — satu perangkat yang daftar lokalnya tidak lengkap
-- menghapus SELURUH karyawan asli di cloud. Penghapusan terjadi di level DB
-- sehingga tidak masuk Recycle Bin.
--
-- Pengaman di aplikasi (src/cloudSync.ts) hanya berlaku untuk perangkat yang
-- menjalankan versi terbaru. Perangkat dengan bundle lama, atau panggilan
-- langsung ke API, melewatinya begitu saja — karena anon key ada di bundle
-- publik dan policy RLS mengizinkan delete. Trigger di bawah ini menutup celah
-- itu di level DB, sehingga penolakan tetap terjadi walau kliennya versi lama.
--
-- Aturannya (sengaja lebih longgar dari pengaman aplikasi agar TIDAK bentrok
-- dengan hapus wajar satu-per-satu):
--   1 perintah DELETE ditolak bila menghapus > 8 baris DAN > 25% isi tabel.
-- Hapus yang MEMANG disengaja lewat tombol "Hapus Semua Data Contoh" memakai
-- RPC ari_clear_table() yang menyalakan penanda sesi khusus.
--
-- CATATAN KEAMANAN: karena anon key bersifat publik, RPC ari_clear_table() juga
-- bisa dipanggil siapa pun yang memegang key itu. Trigger ini menutup kecelakaan
-- (perangkat/bug klien), BUKAN penyerang yang sengaja. Penutup penuh butuh
-- Supabase Auth + policy berbasis auth.uid().

-- ---------- Trigger penolak hapus massal ----------
create or replace function public.ari_guard_mass_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  jumlah integer;   -- baris yang dihapus perintah ini
  sisa integer;     -- sisa baris tabel setelah perintah ini
  batas constant integer := 8;
begin
  -- RPC ari_clear_table() menyalakan penanda ini di transaksi yang sama.
  if coalesce(current_setting('ari.allow_mass_delete', true), '') = 'on' then
    return null;
  end if;

  select count(*) into jumlah from deleted_rows;
  if jumlah <= batas then
    return null;
  end if;

  execute format('select count(*) from public.%I', tg_table_name) into sisa;
  -- Ekuivalen dengan "jumlah > 25% dari isi tabel sebelum hapus" (jumlah > sisa/3),
  -- supaya ambangnya sama persis dengan pengaman di aplikasi dan tidak bentrok.
  if jumlah * 3 > sisa then
    raise exception 'Ditolak: satu perintah menghapus % baris dari tabel % (sisa %). Penghapusan massal hanya boleh lewat aksi yang disengaja.', jumlah, tg_table_name, sisa
      using errcode = '42501';
  end if;
  return null;
end $$;

-- Pasang pada semua tabel data. Tabel yang belum ada dilewati, jadi skrip ini
-- tetap aman walau supabase/setup.sql terbaru belum dijalankan.
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
      execute format('drop trigger if exists ari_guard_mass_delete on public.%I', t);
      execute format(
        'create trigger ari_guard_mass_delete after delete on public.%I referencing old table as deleted_rows for each statement execute function public.ari_guard_mass_delete()',
        t
      );
    end if;
  end loop;
end $$;

-- ---------- Jalan keluar untuk hapus yang disengaja ----------
-- Mengosongkan satu tabel penuh, dipakai tombol "Hapus Semua Data Contoh".
-- Dibatasi hanya tabel berawalan ari_ di schema public.
create or replace function public.ari_clear_table(p_table text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if left(p_table, 4) <> 'ari_' then
    raise exception 'Tabel % tidak diizinkan untuk dikosongkan.', p_table;
  end if;
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = p_table) then
    raise exception 'Tabel % tidak ditemukan.', p_table;
  end if;

  -- Penanda berlako transaksi; trigger di atas akan melihatnya.
  perform set_config('ari.allow_mass_delete', 'on', true);
  execute format('delete from public.%I', p_table);
end $$;

grant execute on function public.ari_clear_table(text) to anon, authenticated;

-- ---------- Verifikasi ----------
-- Daftar tabel yang sudah terpasang pengaman:
select c.relname as tabel
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and t.tgname = 'ari_guard_mass_delete'
order by 1;

-- Uji coba (opsional, aman): perintah berikut HARUS gagal dengan error 42501.
--   delete from public.ari_employees;
-- Perintah berikut harus BERHASIL (lewat jalur disengaja):
--   select public.ari_clear_table('ari_attendance_failures');

-- ============================================================
-- Pemulihan (jalur terakhir yang harus selalu ada):
-- 1. Supabase Dashboard > Database > Backups — aktifkan Daily Backup.
-- 2. Untuk pemulihan per-detik, aktifkan Point-in-Time Recovery (PITR)
--    (paket berbayar). Ini yang paling menentukan: tanpa cadangan, semua
--    pengaman di atas hanya mencegah, tidak memulihkan.
-- 3. Cadangan mandiri berkala: node scripts/backup-cloud.mjs
-- ============================================================
