-- Index unik anti penjualan ganda — jalankan SETELAH backfill-dup-hash.mjs.
-- Baris tanpa field pembanding (dup_hash NULL) dibolehkan berapa pun.
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_dup_hash
  ON ari_marketplace_item_sales (dup_hash);
