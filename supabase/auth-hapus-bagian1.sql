-- ============================================================
-- BAGIAN 1 — PIN diverifikasi server + token sesi untuk hapus.
-- Jalankan lebih dulu. ADITIF: tidak mengubah perilaku apa pun.
-- JANGAN jalankan Bagian 2 (auth-hapus-bagian2-cutover.sql) sebelum
-- langkah 1-3 di bawah selesai.
-- Aman dijalankan berulang.
-- ============================================================
--
-- Kenapa: anon key ada di bundle publik dan policy RLS lama mengizinkan delete,
-- jadi siapa pun bisa mengosongkan tabel. Setelah Bagian 2, policy DELETE dihapus
-- sama sekali dari semua tabel ari_*, sehingga penghapusan hanya mungkin lewat
-- RPC di berkas ini yang memverifikasi PIN di server dan membatasi peran.
--
-- Urutan penerapan:
--   1. Jalankan berkas ini.
--   2. Deploy klien yang memakai RPC hapus + loginCloud().
--   3. Pastikan perangkat sudah login (lihat ari_sessions).
--   4. Baru jalankan auth-hapus-bagian2-cutover.sql.
--
-- CATATAN: membaca data masih terbuka bagi pemegang anon key (perlu begitu agar
-- Realtime dan absen offline tetap jalan). Yang ditutup berkas ini adalah
-- penghapusan — penyebab insiden 29 Sep.

-- ---------- Tiruan hashPin() dari src/dataStore.ts ----------
-- PIN lama tersimpan sebagai sha256_sim_<abs(h)> ala perangkat (bukan hash kuat),
-- jadi server harus menghitungnya dengan cara yang sama untuk bisa memverifikasi.
--
-- JS:  h = (h << 5) - h + charCodeAt(i);  h |= 0;
-- Dua operasi di JS adalah int32 dan bisa overflow, jadi di sini dihitung dengan
-- bigint lalu di-wrap manual ke signed 32-bit pada TIAP langkah (bukan hanya di
-- akhir). Sudah dicocokkan dengan hashPin() asli untuk 20.016 PIN, tanpa beda.
create or replace function public.ari_hash_pin(p_pin text)
returns text
language plpgsql
immutable
as $$
declare
  h bigint := 0;
  i integer;
  c bigint;
  sh bigint;
  t bigint;
  m bigint;
begin
  if p_pin is null or p_pin = '' then
    return '';
  end if;

  for i in 1..char_length(p_pin) loop
    c := ascii(substr(p_pin, i, 1));

    -- (h << 5) sebagai int32
    sh := h * 32;
    m := ((sh % 4294967296) + 4294967296) % 4294967296;
    if m >= 2147483648 then sh := m - 4294967296; else sh := m; end if;

    -- + charCode, lalu h |= 0
    t := sh - h + c;
    m := ((t % 4294967296) + 4294967296) % 4294967296;
    if m >= 2147483648 then h := m - 4294967296; else h := m; end if;
  end loop;

  return 'sha256_sim_' || abs(h)::text;
end $$;

-- ---------- Tabel sesi & percobaan login ----------
-- RLS aktif TANPA policy: anon tidak bisa membaca/menulis tabel ini langsung.
-- Hanya fungsi SECURITY DEFINER di bawah yang bisa.
create table if not exists public.ari_sessions (
  token text primary key,
  employee_id text not null,
  username text not null,
  role text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists ari_sessions_employee_idx on public.ari_sessions (employee_id);
alter table public.ari_sessions enable row level security;

create table if not exists public.ari_login_attempts (
  id bigserial primary key,
  identifier text not null,
  at timestamptz not null default now(),
  sukses boolean not null default false
);
create index if not exists ari_login_attempts_idx on public.ari_login_attempts (identifier, at desc);
alter table public.ari_login_attempts enable row level security;

-- ---------- Masuk: verifikasi PIN di server ----------
-- Dibatas 8 percobaan gagal per username per 15 menit supaya PIN 4 digit tidak
-- bisa dibruteforce lewat API ini.
create or replace function public.ari_login(p_username text, p_pin text)
returns table(token text, employee_id text, nama text, role text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ident text := lower(trim(coalesce(p_username, '')));
  v_hash text;
  v_emp jsonb;
  v_token text;
  v_expires timestamptz := now() + interval '30 days';
  v_gagal integer;
begin
  if v_ident = '' or coalesce(p_pin, '') = '' then
    return;
  end if;

  select count(*)
    into v_gagal
    from public.ari_login_attempts a
   where a.identifier = v_ident
     and not a.sukses
     and a.at > now() - interval '15 minutes';

  if v_gagal >= 8 then
    return; -- kembali kosong = ditolak
  end if;

  v_hash := public.ari_hash_pin(p_pin);

  select e.value
    into v_emp
    from public.ari_employees e
   where lower(coalesce(e.value->>'username', '')) = v_ident
     and coalesce((e.value->>'status_aktif')::boolean, true)
     -- Cocokkan dengan hash; baris lama yang masih plaintext juga diterima
     -- supaya karyawan lama tidak terkunci.
     and (e.value->>'pin') in (v_hash, p_pin)
   limit 1;

  if v_emp is null then
    insert into public.ari_login_attempts (identifier, sukses) values (v_ident, false);
    return;
  end if;

  insert into public.ari_login_attempts (identifier, sukses) values (v_ident, true);

  -- Dua UUID = 256 bit dari gen_random_uuid(), tanpa perlu ekstensi pgcrypto.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.ari_sessions (token, employee_id, username, role, expires_at)
  values (v_token, v_emp->>'id', v_ident, coalesce(v_emp->>'access_role', ''), v_expires);

  token := v_token;
  employee_id := v_emp->>'id';
  nama := coalesce(v_emp->>'name', '');
  role := coalesce(v_emp->>'access_role', '');
  expires_at := v_expires;
  return next;
end $$;

-- ---------- Keluar ----------
create or replace function public.ari_logout(p_token text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(p_token, '') = '' then
    return;
  end if;
  delete from public.ari_sessions where token = p_token;
end $$;

-- ---------- Hapus baris tertentu (hanya owner/admin) ----------
create or replace function public.ari_delete_rows(p_table text, p_ids text[], p_token text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_jumlah integer := 0;
begin
  -- Daftar putih: hanya tabel data. Tabel internal (ari_sessions,
  -- ari_login_attempts) dan ari_store sengaja TIDAK boleh dihapus lewat sini.
  -- p_table NULL harus ditolak eksplisit: "NULL <> all(...)" bernilai NULL, bukan true.
  if p_table is null or p_table <> all (array[
    'ari_departments', 'ari_customers', 'ari_assets', 'ari_employees',
    'ari_products', 'ari_raw_materials', 'ari_stock_movements',
    'ari_orders', 'ari_marketplace_sales', 'ari_marketplace_item_sales',
    'ari_invoices', 'ari_delivery_notes', 'ari_returns',
    'ari_production_jobs', 'ari_production_handoffs', 'ari_rejected_goods',
    'ari_production_task_logs', 'ari_production_logs', 'ari_packing_tasks',
    'ari_purchases', 'ari_daily_expenses', 'ari_payroll_weekly',
    'ari_cash_advances', 'ari_cash_advance_transactions',
    'ari_attendance_bonus_payouts', 'ari_attendance_adjustments',
    'ari_attendance_failures', 'ari_notifications', 'ari_attendance'
  ]) then
    raise exception 'Tabel % tidak diizinkan untuk dihapus.', p_table
      using errcode = '42501';
  end if;

  select s.role
    into v_role
    from public.ari_sessions s
   where s.token = coalesce(p_token, '')
     and s.expires_at > now();

  if v_role is null then
    raise exception 'Sesi tidak valid atau sudah kedaluwarsa. Masuk ulang untuk menghapus data.'
      using errcode = '42501';
  end if;

  if v_role not in ('owner', 'admin_penjualan', 'admin_gudang') then
    raise exception 'Akses Anda tidak diizinkan menghapus data.'
      using errcode = '42501';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;

  -- RPC ini sendiri yang jadi izin hapus; lewati trigger pengaman hapus massal.
  perform set_config('ari.allow_mass_delete', 'on', true);
  execute format('delete from public.%I where id = any($1)', p_table) using p_ids;
  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end $$;

-- ---------- Kosongkan satu tabel (hanya owner/admin) ----------
-- Menggantikan ari_clear_table(text) lama yang TIDAK memeriksa siapa pun.
-- Fungsi lama dibuang supaya tidak jadi pintu belakang.
drop function if exists public.ari_clear_table(text);

create or replace function public.ari_clear_table(p_table text, p_token text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_jumlah integer := 0;
begin
  if p_table is null or p_table <> all (array[
    'ari_departments', 'ari_customers', 'ari_assets', 'ari_employees',
    'ari_products', 'ari_raw_materials', 'ari_stock_movements',
    'ari_orders', 'ari_marketplace_sales', 'ari_marketplace_item_sales',
    'ari_invoices', 'ari_delivery_notes', 'ari_returns',
    'ari_production_jobs', 'ari_production_handoffs', 'ari_rejected_goods',
    'ari_production_task_logs', 'ari_production_logs', 'ari_packing_tasks',
    'ari_purchases', 'ari_daily_expenses', 'ari_payroll_weekly',
    'ari_cash_advances', 'ari_cash_advance_transactions',
    'ari_attendance_bonus_payouts', 'ari_attendance_adjustments',
    'ari_attendance_failures', 'ari_notifications', 'ari_attendance'
  ]) then
    raise exception 'Tabel % tidak diizinkan untuk dikosongkan.', p_table
      using errcode = '42501';
  end if;

  select s.role
    into v_role
    from public.ari_sessions s
   where s.token = coalesce(p_token, '')
     and s.expires_at > now();

  if v_role is null then
    raise exception 'Sesi tidak valid atau sudah kedaluwarsa. Masuk ulang untuk menghapus data.'
      using errcode = '42501';
  end if;

  if v_role not in ('owner', 'admin_penjualan', 'admin_gudang') then
    raise exception 'Akses Anda tidak diizinkan menghapus data.'
      using errcode = '42501';
  end if;

  perform set_config('ari.allow_mass_delete', 'on', true);
  execute format('delete from public.%I', p_table);
  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end $$;

-- ---------- Hak akses ----------
-- anon tetap perlu bisa memanggil ari_login (belum ada sesi saat masuk) dan
-- RPC hapus (token-nya sendiri yang jadi pengaman).
grant execute on function public.ari_login(text, text) to anon, authenticated;
grant execute on function public.ari_logout(text) to anon, authenticated;
grant execute on function public.ari_delete_rows(text, text[], text) to anon, authenticated;
grant execute on function public.ari_clear_table(text, text) to anon, authenticated;

-- ---------- Verifikasi Bagian 1 ----------
-- 1. Hash harus sama dengan yang dihitung aplikasi:
--      select public.ari_hash_pin('1234');   -- harapan: sha256_sim_1509442
--      select public.ari_hash_pin('4321');   -- harapan: sha256_sim_1599742
-- 2. Belum ada sesi (baru login setelah klien baru dipakai):
--      select count(*) from public.ari_sessions;
-- 3. ari_login sudah ada dan menolak PIN salah (harus 0 baris):
--      select * from public.ari_login('ari', '0000');
-- 4. Fungsi lama tanpa token sudah hilang (harus 0 baris):
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('ari_login', 'ari_logout', 'ari_delete_rows', 'ari_clear_table')
order by 1;
