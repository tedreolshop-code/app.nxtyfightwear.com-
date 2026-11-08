// Backfill dup_hash untuk seluruh ari_marketplace_item_sales (sekali).
//   node scripts/backfill-dup-hash.mjs
// Baris dikirim utuh (value + updated_at asli) — hash dihitung server, dan
// updated_at tidak berubah supaya perangkat lain tidak menarik ulang.
// Setelah selesai: buat unique index via server/optimize2-unique.sql.
const BASE = 'https://ari-cloud-api.tediekonom.workers.dev';

const post = async (path, body) => (await fetch(`${BASE}${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})).json();

let updated = 0;
for (let off = 0; ; off += 500) {
  const res = await post('/api/q', { table: 'ari_marketplace_item_sales', columns: ['id', 'value', 'updated_at'], limit: 500, offset: off });
  const rows = res.data ?? [];
  if (rows.length === 0) break;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100).map(row => ({
      id: row.id, value: row.value ?? {}, updated_at: row.updated_at ?? new Date().toISOString(),
    }));
    const r = await post('/api/upsert', { table: 'ari_marketplace_item_sales', rows: batch, onConflict: 'id' });
    if (r.error) { console.error('GAGAL batch:', r.error); process.exit(1); }
    updated += batch.length;
  }
  if (rows.length < 500) break;
  console.log(`  ${updated} baris diproses...`);
}
console.log(`Selesai: ${updated} baris diberi dup_hash (updated_at asli dipertahankan).`);
console.log('Sekarang buat unique index: cd server && npx wrangler d1 execute ari-store --remote --file optimize2-unique.sql -y');
