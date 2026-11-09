-- Kolom nama karyawan pada registry perangkat (audit perangkat, tugas 7):
-- daftar perangkat harus bisa dibaca manusia — admin tahu langsung perangkat
-- SIAPA yang bermasalah tanpa memeriksa satu per satu.
--   cd server && npx wrangler d1 execute ari-store --remote --file optimize4-device-name.sql -y
-- CATATAN: jalankan SEKALI. SQLite tidak punya ADD COLUMN IF NOT EXISTS —
-- bila kolom sudah ada, error "duplicate column name" boleh diabaikan.
ALTER TABLE ari_devices ADD COLUMN name TEXT NOT NULL DEFAULT '';
