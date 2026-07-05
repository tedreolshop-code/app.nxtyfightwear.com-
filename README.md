# ARI SPORTINDO — Sistem Produksi & Manajemen

Sistem internal untuk manajemen pesanan, produksi (Eva Foam & Konveksi), gudang,
pembelian, penjualan marketplace, absensi karyawan, dan payroll.

## Menjalankan

```bash
npm install
npm run dev      # buka http://localhost:3000
```

## Login

Satu pintu untuk semua: **username + PIN 4 digit**. Menu yang terbuka mengikuti
"Akses Sistem" di profil karyawan (diatur Owner lewat menu Karyawan):
Owner · Admin (Penjualan & Pembelian) · Gudang & Produksi · Karyawan (Absensi & Gaji).

## Sinkronisasi Cloud (Supabase)

Opsional — tanpa konfigurasi, data tersimpan di browser (localStorage).

1. Buat project di supabase.com, jalankan `supabase/setup.sql` di SQL Editor.
2. Salin URL & anon key ke file `.env`:
   ```
   VITE_SUPABASE_URL="https://xxxx.supabase.co"
   VITE_SUPABASE_ANON_KEY="eyJ..."
   ```
3. Restart dev server — indikator sidebar menunjukkan "Tersinkron ke Cloud".

## Build Produksi

```bash
npm run build    # hasil di dist/
npm run lint     # typecheck
```
