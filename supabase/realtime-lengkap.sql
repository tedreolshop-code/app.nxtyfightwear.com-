-- ============================================================
-- Realtime lengkap untuk SEMUA tabel data + anti-duplikat penjualan.
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman diulang.
--
-- Latar: publikasi realtime sebelumnya hanya memuat 3 tabel
-- (ari_store, ari_attendance, ari_employees), sehingga perubahan di
-- 25+ tabel lain (penjualan item, order, payroll, pengeluaran, dsb.)
-- TIDAK PERNAH terkirim realtime antar perangkat — kelihatannya seperti
-- "data tidak singkron" padahal langganannya memang kosong.
--
-- Setelah skrip ini: input di satu perangkat muncul di perangkat lain
-- dalam +-1 detik tanpa reload, dan baris penjualan identik ditolak DB.
-- ============================================================

-- LANGKAH 1 — daftarkan semua tabel data ke publikasi supabase_realtime
do $$
declare t text;
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
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t)
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- LANGKAH 2 — tolak baris penjualan marketplace yang identik (anti duplikat).
-- Identik = no. pesanan + produk + varian + qty + harga + tanggal + channel
-- sama persis. Baris dengan id sama tetap bisa di-update (edit aman).
create or replace function public.ari_tolak_penjualan_ganda()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.ari_marketplace_item_sales s
    where s.id <> new.id
      and s.value->>'order_number'   = new.value->>'order_number'
      and s.value->>'description'    = new.value->>'description'
      and coalesce(s.value->>'variant','') is not distinct from coalesce(new.value->>'variant','')
      and s.value->>'qty'            = new.value->>'qty'
      and s.value->>'price'          = new.value->>'price'
      and s.value->>'date'           = new.value->>'date'
      and s.value->>'marketplace_ref' = new.value->>'marketplace_ref'
  ) then
    raise notice 'Baris penjualan identik sudah ada (no %) — duplikasi ditolak.', new.value->>'order_number';
    return null;
  end if;
  return new;
end $$;

drop trigger if exists ari_tolak_penjualan_ganda on public.ari_marketplace_item_sales;
create trigger ari_tolak_penjualan_ganda
before insert on public.ari_marketplace_item_sales
for each row execute function public.ari_tolak_penjualan_ganda();

-- LANGKAH 3 — verifikasi: daftar tabel yang sudah realtime
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
