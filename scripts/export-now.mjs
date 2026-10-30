// Ekspor data Supabase SEKARANG (saat REST API diblokir quota) lewat Management
// API — jalur dashboard yang tetap hidup.
//
//   SUPABASE_PAT=... node scripts/export-now.mjs
//
// PAT dibuat di https://supabase.com/dashboard/account/tokens — JANGAN di-commit.
// Hasil: backup/<timestamp>/<tabel>.json (format identik export-supabase.mjs) +
// _ringkasan.json — langsung bisa dipakai scripts/import-d1.mjs.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const REF = 'bxndouvwisjlcidkirck';
const PAT = process.env.SUPABASE_PAT || '';
if (!PAT) { console.error('Butuh SUPABASE_PAT di environment.'); process.exit(1); }

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

const PAGE = 500;
const q = async (sql) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Respons bukan JSON: ${text.slice(0, 300)}`); }
  if (!Array.isArray(json)) throw new Error(`Respons tak terduga: ${text.slice(0, 300)}`);
  return json;
};

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = join('backup', stamp);
await mkdir(dir, { recursive: true });

// Foto (jumlah, untuk panduan unduh manual dari dashboard Storage).
try {
  const c = await q(`select count(*) as c from storage.objects where bucket_id = 'delivery-photos'`);
  console.log(`Foto di bucket delivery-photos: ${c[0]?.c ?? 0} berkas (unduh via dashboard Storage).`);
} catch (e) {
  console.error(`Foto: hitung gagal (${e instanceof Error ? e.message : String(e)})`);
}

let gagal = 0;
let total = 0;
for (const table of TABLES) {
  try {
    // escape identifer sederhana: nama tabel konstanta internal, aman.
    const totalRows = (await q(`select count(*) as c from ${table}`))[0]?.c ?? 0;
    const rows = [];
    for (let offset = 0; offset < totalRows; offset += PAGE) {
      const chunk = await q(`select * from ${table} limit ${PAGE} offset ${offset}`);
      rows.push(...chunk);
      if (chunk.length < PAGE) break;
    }
    await writeFile(join(dir, `${table}.json`), JSON.stringify(rows));
    total += rows.length;
    console.log(`  ok    ${table.padEnd(32)} ${rows.length}/${totalRows} baris`);
  } catch (e) {
    gagal++;
    console.error(`  GAGAL ${table.padEnd(32)} ${e instanceof Error ? e.message : String(e)}`);
  }
}

await writeFile(join(dir, '_ringkasan.json'), JSON.stringify({
  dibuat_pada: new Date().toISOString(),
  cara: 'management-api (quota aktif)',
  jumlah_baris: total,
  tabel_gagal: gagal,
}, null, 2));

console.log(`\nSelesai: ${total} baris → ${dir}`);
if (gagal > 0) { console.error(`${gagal} tabel gagal.`); process.exit(1); }
