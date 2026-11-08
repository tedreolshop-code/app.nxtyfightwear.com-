# ARI cloud API — Cloudflare Worker (D1 + R2)

Backend pengganti Supabase untuk sinkronisasi data & foto packing.
Worker + D1 (SQLite) menyimpan tabel `ari_*` dengan format yang sama seperti
Supabase: `(id, value JSON, updated_at)`; R2 menyimpan foto pengganti bucket
`delivery-photos`.

## Ikhtisar endpoint

| Endpoint | Fungsi |
|---|---|
| POST /api/q       | kueri `select(cols).eq/gt/gte/lte/in/range/maybeSingle` |
| POST /api/upsert  | insert/update baris (`onConflict id/key`, `ignoreDuplicates`) |
| POST /api/login   | verifikasi PIN → token sesi (rate limit 8x/15 menit) |
| POST /api/logout  | hapus sesi |
| POST /api/delete  | hapus ids — **wajib token+role** (owner/admin) + guard massal |
| POST /api/clear   | kosongkan tabel — **wajib token+role** |
| POST /api/photo   | upload foto multipart → R2 |
| GET /api/photo/:k | serve foto langsung dari R2 (fallback bila belum ada domain publik) |
| DELETE /api/photo | hapus foto (dipicu UI; jendela 14 hari tetap di kontrol klien) |

## Langkah pemasangan (sekali)

```bash
cd server
npm install          # wrangler
npx wrangler login
npx wrangler d1 create ari-store            # salin database_id → wrangler.toml
npx wrangler r2 bucket create ari-delivery-photos
npm run d1:schema                            # terapkan schema.sql
npm run deploy                               # → URL hasil deploy ke .env (VITE_API_BASE_URL)
# opsional: aktifkan domain publik bucket R2 di dashboard → set R2_PUBLIC_URL
# opsional: ALLOWED_ORIGINS di wrangler.toml sesuai domain app produksi
```

## Backup otomatis via GitHub Actions

Workflow `.github/workflows/backup-d1.yml` menjalankan ekspor harian 06:00 WIB,
mengenkripsi (AES-256), lalu menyimpannya sebagai artifact GitHub (retensi 21 hari).

Setup sekali (GitHub → Settings → Secrets and variables → Actions):
- `CLOUDFLARE_API_TOKEN` — token Cloudflare berizin **D1 read** saja.
- `BACKUP_PASSPHRASE` — frasa sandi enkripsi; simpan juga di luar GitHub.

Restore:
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -in d1-backup-*.sql.gz.enc -pass pass:<PASSPHRASE> | gzip -d > dump.sql
# disarankan: buat database BARU lalu import, atau kosongkan tabel lama dulu:
cd server && npx wrangler d1 execute ari-store --remote --file dump.sql -y
```

## Migrasi data Supabase → D1

```bash
# di WSL (root project):
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/export-supabase.mjs
# (quota Supabase reset 4 Nov 2026 — atau ekspor lewat LAN)

# deploy Worker dulu, lalu:
CLOUD_API_URL=https://<workers.dev> node scripts/import-d1.mjs backup/<ts> --local
# uji coba lokal oke → jalankan --remote (butuh wrangler login)

# bandingkan jumlah baris: _ringkasan.json (hasil export) vs output import.
```

## Catatan perilaku

- Pembacaan data terbuka (paritas policy Supabase: anon select `using true`).
  Penghapusan hanya lewat token sesi hasil login PIN (role owner/admin*).
- Guard hapus massal cermin `guard-mass-delete.sql`: >8 baris & >25% isi tabel
  dalam SATU operasi ditolak.
- Penjualan ganda (7 field identik, id berbeda) ditolak di `/api/upsert`
  (cermin trigger `realtime-lengkap.sql`).
- Foto boleh diunggah/dihapus tanpa token — paritas dengan bucket publik
  Supabase sebelumnya; pembatasan menyusul bila dibutuhkan.
- Tidak ada realtime. Klien memakai tarik bertahap tiap 30 detik saat halaman
  terlihat; latensi lintas perangkat ≈ 30 detik.
