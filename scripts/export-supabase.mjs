// Ekspor lengkap untuk migrasi Supabase → Cloudflare (D1 + R2).
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/export-supabase.mjs
//
// Hasil (backup/<timestamp>/):
//   <tabel>.json      seluruh baris tiap tabel ari_* (JSON)
//   photos/<nama>     seluruh objek bucket 'delivery-photos'
//   _ringkasan.json   jumlah baris + daftar foto
// Import lanjut: scripts/import-d1.mjs
//
// Jalankan SETELAH Supabase quota reset (4 Nov 2026) atau via LAN.

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

const BUCKET = 'delivery-photos';
const PHOTO_FIELDS = ['shipping_proof_url', 'photo_url'];

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Butuh SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di environment.');
  process.exit(1);
}

const client = createClient(url, key);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = join('backup', stamp);
const photosDir = join(dir, 'photos');
await mkdir(photosDir, { recursive: true });

// ---------- Tabel ----------
let gagal = 0;
let total = 0;
for (const table of TABLES) {
  const rows = [];
  try {
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

// ---------- Foto ----------
const fotoList = [];
try {
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage.from(BUCKET).list('', { limit: 100, offset });
    if (error) throw error;
    fotoList.push(...(data || []).filter(o => o && o.name));
    if (!data || data.length < 100) break;
    offset += 100;
  }
  let tulis = 0;
  for (const obj of fotoList) {
    try {
      const { data: file, error } = await client.storage.from(BUCKET).download(obj.name);
      if (error || !file) throw error || new Error('kosong');
      await writeFile(join(photosDir, obj.name), Buffer.from(await file.arrayBuffer()));
      tulis++;
    } catch (e) {
      console.error(`  foto gagal ${obj.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`  foto: ${tulis}/${fotoList.length} diekspor → ${photosDir}`);
} catch (e) {
  console.error(`  Gagal daftar bucket foto: ${e instanceof Error ? e.message : String(e)}`);
}

// Referensi yang menunggu penulisan-ulang URL oleh import-d1.mjs.
let referensiFoto = 0;
for (const table of ['ari_orders', 'ari_packing_tasks', 'ari_marketplace_item_sales']) {
  try {
    const { data, error } = await client.from(table).select('id, value');
    if (error) throw error;
    for (const row of data || []) {
      const v = row?.value || {};
      if (PHOTO_FIELDS.some(f => typeof v[f] === 'string' && v[f].startsWith('http'))) referensiFoto++;
    }
    console.log(`  ${table}: referensi foto dihitung (lihat import-d1.mjs)`);
  } catch (e) {
    console.error(`  Gagal hitung referensi ${table}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

await writeFile(join(dir, '_ringkasan.json'), JSON.stringify({
  dibuat_pada: new Date().toISOString(),
  supabase_url: url,
  jumlah_baris: total,
  tabel_gagal: gagal,
  jumlah_foto: fotoList.length,
  referensi_foto: referensiFoto,
}, null, 2));

console.log(`\nSelesai: ${total} baris → ${dir}`);
if (gagal > 0) {
  console.error(`${gagal} tabel gagal diekspor.`);
  process.exit(1);
}
