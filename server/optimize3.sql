-- Registry perangkat (audit perangkat, tugas 7): admin melihat perangkat mana
-- yang aktif/bermasalah tanpa menyuruh karyawan memeriksa apa pun.
--   cd server && npx wrangler d1 execute ari-store --remote --file optimize3.sql -y
CREATE TABLE IF NOT EXISTS ari_devices (
  device_id  TEXT PRIMARY KEY,
  last_sync  TEXT NOT NULL,
  pending    INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT NOT NULL DEFAULT ''
);
