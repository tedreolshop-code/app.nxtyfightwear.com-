-- Setup database ARI SPORTINDO Production System
-- Jalankan sekali di Supabase Dashboard > SQL Editor.

-- Tabel key-value: satu baris per "tabel" aplikasi (orders, products, attendance, dst).
create table if not exists public.ari_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Aktifkan Realtime agar perubahan langsung tersebar ke semua perangkat.
alter publication supabase_realtime add table public.ari_store;

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

alter publication supabase_realtime add table public.ari_attendance;

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

-- Hapus sisa data absensi model lama (array utuh) dari ari_store bila ada.
delete from public.ari_store where key = 'attendance';
