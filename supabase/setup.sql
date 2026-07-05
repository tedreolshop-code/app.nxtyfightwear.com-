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
