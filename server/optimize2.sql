-- Optimasi gelombang 2 (dari audit 8 Nov) — jalankan sekali:
--   cd server && npx wrangler d1 execute ari-store --remote --file optimize2.sql -y
-- 1) dels: penghitung kumulatif penghapusan per tabel → klien skip baca-ID
--    saat tidak ada penghapusan (hemat baca terbesar).
-- 2) Index ekspresi tanggal penjualan (riwayat marketplace).
-- 3) dup_hash: kolom hash 7-field anti penjualan ganda (index unik dibuat
--    TERPISAH setelah backfill, lihat scripts/backfill-dup-hash.mjs).

ALTER TABLE ari_sync_state ADD COLUMN dels INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ari_marketplace_item_sales_date_expr_idx
  ON ari_marketplace_item_sales (json_extract(value, '$.date'));

ALTER TABLE ari_marketplace_item_sales ADD COLUMN dup_hash TEXT;
