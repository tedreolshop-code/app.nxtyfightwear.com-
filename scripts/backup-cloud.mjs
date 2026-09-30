// Cadangan mandiri: ekspor seluruh tabel ari_* dari Supabase ke berkas JSON.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-cloud.mjs
//
// Service role key BUKAN anon key dan melewati RLS — jangan pernah dimasukkan ke
// bundle aplikasi atau di-commit; simpan hanya di environment penjadwal.
// Hasil ditulis ke backup/<timestamp>/ (sudah di-.gitignore, berisi data karyawan).

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const TABLES = [
  'ari_store', 'ari_attendance',
  'ari_departments', 'ari_customers', 'ari_assets',
  'ari_employees', 'ari_products', 'ari_raw_materials', 'ari_stock_movements',
  'ari_orders', 'ari_marketplace_sales', 'ari_marketplace_item_sales',
  'ari_invoices', 'ari_delivery_notes', 'ari_returns',
  'ari_production_jobs', 'ari_production_handoffs', 'ari_rejected_goods',
  'ari_production_task_logs', 'ari_production_logs', 'ari_packing_tasks',
  'ari_purchases', 'ari_daily_expenses',
  'ari_payroll_weekly', 'ari_cash_advances', 'ari_cash_advance_transactions',
  'ari_attendance_bonus_payouts', 'ari_attendance_adjustments',
  'ari_attendance_failures', 'ari_notifications',
];

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Butuh SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di environment.');
  process.exit(1);
}

const client = createClient(url, key);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = join('backup', stamp);

await mkdir(dir, { recursive: true });

let gagal = 0;
let total = 0;

for (const table of TABLES) {
  const rows = [];
  try {
    // PostgREST membatasi 1000 baris per request — tarik bertahap sampai habis.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client.from(table).select('*').range(from, from + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    await writeFile(join(dir, `${table}.json`), JSON.stringify(rows));
    total += rows.length;
    console.log(`  ok    ${table.padEnd(32)} ${rows.length} baris`);
  } catch (e) {
    gagal++;
    console.error(`  GAGAL ${table.padEnd(32)} ${e instanceof Error ? e.message : String(e)}`);
  }
}

await writeFile(join(dir, '_ringkasan.json'), JSON.stringify({
  dibuat_pada: new Date().toISOString(),
  supabase_url: url,
  jumlah_baris: total,
  tabel_gagal: gagal,
}, null, 2));

console.log(`\nSelesai: ${total} baris → ${dir}`);
if (gagal > 0) {
  console.error(`${gagal} tabel gagal diekspor.`);
  process.exit(1);
}
