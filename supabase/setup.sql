-- Setup database ARI SPORTINDO Production System
-- Jalankan sekali di Supabase Dashboard > SQL Editor.

-- Tabel key-value: satu baris per "tabel" aplikasi (orders, products, attendance, dst).
create table if not exists public.ari_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Aktifkan Realtime agar perubahan langsung tersebar ke semua perangkat.
-- (dilewati otomatis bila sudah terdaftar, jadi skrip aman dijalankan ulang)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ari_store'
  ) then
    alter publication supabase_realtime add table public.ari_store;
  end if;
end $$;

-- Row Level Security.
-- CATATAN: kebijakan di bawah mengizinkan siapa pun yang memegang anon key membaca/menulis.
-- Cukup untuk sistem internal UMKM (anon key tidak dipublikasikan), tetapi bila nanti
-- memakai Supabase Auth, ganti "using (true)" menjadi pemeriksaan auth.uid().
alter table public.ari_store enable row level security;

drop policy if exists "ari_store_read" on public.ari_store;
create policy "ari_store_read" on public.ari_store
  for select using (true);

drop policy if exists "ari_store_write" on public.ari_store;
create policy "ari_store_write" on public.ari_store
  for insert with check (true);

drop policy if exists "ari_store_update" on public.ari_store;
create policy "ari_store_update" on public.ari_store
  for update using (true);

-- ============================================================
-- Tabel absensi: SATU BARIS PER SCAN (bukan satu array utuh).
-- Insert per baris tidak pernah saling timpa walau banyak karyawan
-- absen bersamaan dari HP masing-masing.
-- ============================================================
create table if not exists public.ari_attendance (
  id text primary key,
  value jsonb not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ari_attendance'
  ) then
    alter publication supabase_realtime add table public.ari_attendance;
  end if;
end $$;

alter table public.ari_attendance enable row level security;

drop policy if exists "ari_attendance_read" on public.ari_attendance;
create policy "ari_attendance_read" on public.ari_attendance
  for select using (true);

drop policy if exists "ari_attendance_write" on public.ari_attendance;
create policy "ari_attendance_write" on public.ari_attendance
  for insert with check (true);

drop policy if exists "ari_attendance_update" on public.ari_attendance;
create policy "ari_attendance_update" on public.ari_attendance
  for update using (true);

-- Delete dibutuhkan tombol "Hapus Semua Data Contoh" (mulai data bersih).
drop policy if exists "ari_attendance_delete" on public.ari_attendance;
create policy "ari_attendance_delete" on public.ari_attendance
  for delete using (true);

-- CATATAN: data model lama (array utuh) di ari_store SENGAJA TIDAK dihapus.
-- Aplikasi mengabaikannya saat membaca (pakai tabel per-baris), dan menyimpannya
-- sebagai cadangan + sumber isian awal (seed) saat migrasi. Menghapusnya lebih
-- awal berisiko menghilangkan data sebelum sempat termigrasi ke tabel per-baris.

-- ============================================================
-- Tabel karyawan: SATU BARIS PER KARYAWAN (bukan satu array utuh).
-- Supabase menjadi SUMBER DATA UTAMA untuk karyawan: tambah/edit/hapus
-- ditulis langsung per baris, sehingga tidak ada lagi "array besar" yang
-- saling menimpa dan membuat karyawan baru hilang kembali ke data awal.
-- ============================================================
create table if not exists public.ari_employees (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ari_employees'
  ) then
    alter publication supabase_realtime add table public.ari_employees;
  end if;
end $$;

alter table public.ari_employees enable row level security;

drop policy if exists "ari_employees_read" on public.ari_employees;
create policy "ari_employees_read" on public.ari_employees
  for select using (true);

drop policy if exists "ari_employees_write" on public.ari_employees;
create policy "ari_employees_write" on public.ari_employees
  for insert with check (true);

drop policy if exists "ari_employees_update" on public.ari_employees;
create policy "ari_employees_update" on public.ari_employees
  for update using (true);

drop policy if exists "ari_employees_delete" on public.ari_employees;
create policy "ari_employees_delete" on public.ari_employees
  for delete using (true);

-- (Data karyawan model lama di ari_store sengaja dibiarkan sebagai cadangan.)

-- ============================================================
-- Tabel per-baris untuk SEMUA data operasional: SATU BARIS PER RECORD.
-- Supabase jadi sumber data utama sehingga stok, penjualan, order, produksi,
-- gaji, kasbon, pembelian, dan faktur tidak "hilang kembali ke data awal".
-- (create table if not exists → aman dijalankan ulang.)
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'ari_departments','ari_customers','ari_assets',
    'ari_products','ari_raw_materials','ari_stock_movements',
    'ari_orders','ari_marketplace_sales','ari_marketplace_item_sales',
    'ari_invoices','ari_delivery_notes','ari_returns',
    'ari_production_jobs','ari_production_handoffs','ari_rejected_goods',
    'ari_production_task_logs','ari_production_logs','ari_packing_tasks',
    'ari_purchases','ari_daily_expenses',
    'ari_payroll_weekly','ari_cash_advances','ari_cash_advance_transactions',
    'ari_attendance_adjustments','ari_notifications'
  ] loop
    execute format('create table if not exists public.%I (id text primary key, value jsonb not null, updated_at timestamptz not null default now())', t);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select using (true)', t, t);
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format('create policy "%s_write" on public.%I for insert with check (true)', t, t);
    execute format('drop policy if exists "%s_update" on public.%I', t, t);
    execute format('create policy "%s_update" on public.%I for update using (true)', t, t);
    execute format('drop policy if exists "%s_delete" on public.%I', t, t);
    execute format('create policy "%s_delete" on public.%I for delete using (true)', t, t);
  end loop;

  -- CATATAN: data model lama (array utuh) di ari_store SENGAJA TIDAK dihapus.
  -- Dibiarkan sebagai cadangan + sumber isian awal (seed) saat migrasi ke tabel
  -- per-baris. Aplikasi sudah mengabaikannya saat membaca, jadi tidak mengganggu.
end $$;

-- ============================================================
-- Storage bucket untuk foto dokumentasi barang keluar, diambil karyawan
-- packing saat menyelesaikan tugas packing (PackingTask.photo_url).
-- Master admin (owner) bisa menghapus foto lewat aplikasi, dibatasi 14 hari
-- sejak upload (dicek di kode aplikasi, bukan di sini).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('delivery-photos', 'delivery-photos', true)
on conflict (id) do nothing;

drop policy if exists "delivery_photos_read" on storage.objects;
create policy "delivery_photos_read" on storage.objects
  for select using (bucket_id = 'delivery-photos');

drop policy if exists "delivery_photos_write" on storage.objects;
create policy "delivery_photos_write" on storage.objects
  for insert with check (bucket_id = 'delivery-photos');

drop policy if exists "delivery_photos_delete" on storage.objects;
create policy "delivery_photos_delete" on storage.objects
  for delete using (bucket_id = 'delivery-photos');
