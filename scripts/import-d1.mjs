// Impor hasil export-supabase.mjs ke Cloudflare D1 + R2.
//
//   node scripts/import-d1.mjs backup/<timestamp>   --local  (D1 lokal, uji coba)
//   node scripts/import-d1.mjs backup/<timestamp>   --remote (produksi)
//
// Yang dilakukan:
//   1. Foto di backup/<ts>/photos/ diunggah ke R2 lewat Worker /api/photo
//      (butuh Worker sudah ter-deploy; set CLOUD_API_URL di environment).
//   2. URL foto lama (supabase storage) di baris JSON ditulis ulang ke URL R2 baru.
//   3. Tiap tabel dikonversi ke SQL INSERT (batch per ~200 baris) lalu eksekusi
//      via `wrangler d1 execute ari-store --local/--remote --file=...`.
//   4. Ringkasan jumlah baris dicetak untuk dibandingkan dengan export.
//
// Kebutuhan environment: CLOUD_API_URL (origin Worker) — diperlukan untuk foto.
// Wrangler login diperlukan untuk --remote.

import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const PHOTO_FIELDS = ['shipping_proof_url', 'photo_url'];
const TABLES = [
  'ari_departments', 'ari_customers', 'ari_assets', 'ari_employees',
  'ari_products', 'ari_raw_materials', 'ari_stock_movements',
  'ari_orders', 'ari_marketplace_sales', 'ari_marketplace_item_sales',
  'ari_invoices', 'ari_delivery_notes', 'ari_returns',
  'ari_production_jobs', 'ari_production_handoffs', 'ari_rejected_goods',
  'ari_production_task_logs', 'ari_production_logs', 'ari_packing_tasks',
  'ari_purchases', 'ari_daily_expenses',
  'ari_payroll_weekly', 'ari_cash_advances', 'ari_cash_advance_transactions',
  'ari_attendance_bonus_payouts', 'ari_attendance_adjustments',
  'ari_attendance_failures', 'ari_notifications',
  'ari_attendance', 'ari_store',
];
// D1 insert dibuang mentah-mentah lalu diimpor ulang dari backup (tiap file mulai
// dengan DELETE FROM <tabel>;).

const [dir, modeArg] = process.argv.slice(2);
if (!dir || !modeArg) {
  console.error('Pakai: node scripts/import-d1.mjs backup/<timestamp> --local|--remote');
  process.exit(1);
}
const remote = modeArg === '--remote';
if (!['--local', '--remote'].includes(modeArg)) {
  console.error('Mode harus --local atau --remote.');
  process.exit(1);
}

const mode = remote ? '--remote' : '--local';
const apiBase = String(process.env.CLOUD_API_URL || '').replace(/\/+$/, '');
const sqlDir = join(dir, '_d1-sql');
await mkdir(sqlDir, { recursive: true });

// ---------- 1. Upload foto ke R2 ----------
const photosDir = join(dir, 'photos');
let fotoFiles = [];
try { fotoFiles = (await readdir(photosDir)).filter(n => !n.startsWith('_')); } catch { /* kosong */ }

const fetchApi = async (path, body, headers) => {
  const res = await fetch(`${apiBase}${path}`, { method: 'POST', body, headers });
  let json = {};
  try { json = await res.json(); } catch { /* abaikan */ }
  return { status: res.status, json };
};

const uploadedKeys = new Set();
if (fotoFiles.length > 0 && !apiBase) {
  console.warn('CLOUD_API_URL tidak diset — foto tidak diunggah; URL lama akan tetap dan gambar rusak.');
}
if (fotoFiles.length > 0 && apiBase) {
  for (const name of fotoFiles) {
    try {
      const buf = await readFile(join(photosDir, name));
      const form = new FormData();
      form.append('key', name);
      form.append('file', new Blob([buf]));
      const { json } = await fetchApi('/api/photo', form, undefined);
      if (json.error) throw new Error(json.error);
      uploadedKeys.add(name);
    } catch (e) {
      console.error(`  foto gagal ${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`  foto: ${uploadedKeys.size}/${fotoFiles.length} tertulis ulang ke R2.`);
}

// ---------- 2. Tulis-ulang URL foto + 3. buat SQL ----------
const r2PublicBase = String(process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
const sqlLiteral = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  const clean = String(v).replace(/'/g, "''");
  return `'${clean}'`;
};
// Kolom foto lama: https://<supabase>/storage/v1/object/public/delivery-photos/<file>
const isOldPhotoUrl = (u) => typeof u === 'string' && u.startsWith('http') && /\/storage\/v1\/object\/(public|authenticated)\//.test(u);

const rewritePhotos = (value) => {
  let berubah = 0;
  for (const field of PHOTO_FIELDS) {
    const url = value[field];
    if (!isOldPhotoUrl(url)) continue;
    const fileName = decodeURIComponent(url.split('/').pop());
    if (!fileName || !uploadedKeys.has(fileName)) continue;
    value[field] = r2PublicBase ? `${r2PublicBase}/${fileName}` : `${apiBase}/api/photo/${fileName}`;
    berubah++;
  }
  return berubah;
};

const counts = {};
const apiRows = []; // baris raksasa: via Worker /api/upsert (bind, tanpa batas setab)
for (const table of TABLES) {
  let rows;
  try {
    rows = JSON.parse(await readFile(join(dir, `${table}.json`), 'utf8'));
  } catch (e) {
    console.error(`  lewati ${table}: berkas tidak ada/tidak bisa dibaca (${e instanceof Error ? e.message : String(e)})`);
    continue;
  }
  counts[table] = Array.isArray(rows) ? rows.length : 0;
  const lines = [`DELETE FROM ${table};`];
  let batchNo = 1;
  let fotoRewrite = 0;
  const flushBatch = async () => {
    if (lines.length === 0) return;
    const file = join(sqlDir, `${table}_${String(batchNo).padStart(4, '0')}.sql`);
    await writeFile(file, lines.join('\n') + '\n');
    lines.length = 0;
    batchNo++;
  };
  for (const row of rows) {
    if (lines.length >= 500) await flushBatch();
    const value = row.value ?? {};
    fotoRewrite += rewritePhotos(value);
    const valueSql = sqlLiteral(JSON.stringify(value));
    let one;
    if (table === 'ari_store') {
      one = `INSERT INTO ari_store (key, value, updated_at) VALUES (${sqlLiteral(row.key)}, ${valueSql}, ${sqlLiteral(row.updated_at)});`;
    } else if (table === 'ari_attendance') {
      one = `INSERT INTO ari_attendance (id, value, created_at) VALUES (${sqlLiteral(row.id)}, ${valueSql}, ${sqlLiteral(row.created_at)});`;
    } else {
      one = `INSERT INTO ${table} (id, value, updated_at) VALUES (${sqlLiteral(row.id)}, ${valueSql}, ${sqlLiteral(row.updated_at)});`;
    }
    // Batas statement SQL D1 — baris raksasa (audit_logs/audit orders) lewat API bind.
    if (one.length > 90_000) {
      const mapped = table === 'ari_store'
        ? { key: row.key, value, updated_at: row.updated_at }
        : (table === 'ari_attendance'
          ? { id: row.id, value, created_at: row.created_at }
          : { id: row.id, value, updated_at: row.updated_at });
      apiRows.push({ table, row: mapped });
      fotoRewrite; // dihitung di atas
      continue;
    }
    lines.push(one);
  }
  await flushBatch();
  if (fotoRewrite > 0) console.log(`  ${table}: ${fotoRewrite} URL foto ditulis ulang.`);
}
console.log('  SQL siap:', sqlDir);

// ---------- 4. Eksekusi SQL ke D1 ----------
for (const table of Object.keys(counts)) {
  const files = (await readdir(sqlDir)).filter(f => f.startsWith(`${table}_`) && f.endsWith('.sql')).sort();
  if (files.length === 0) continue;
  for (const f of files) {
    // wrangler menemukan wrangler.toml dari cwd — jalankan dari folder server/.
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'ari-store', mode,
      '--file', join(process.cwd(), sqlDir, f), '-y'],
        { stdio: 'inherit', shell: true, cwd: 'server' });
  }
}

// ---------- 5. Baris raksasa (melebihi batas statement SQL) — lewat API bind. ----------
if (apiRows.length > 0) {
  console.log(`  ${apiRows.length} baris raksasa dikirim lewat API (butuh CLOUD_API_URL).`);
  if (!apiBase) {
    console.error('CLOUD_API_URL tidak diset — baris raksasa tidak bisa dikirim.');
    process.exitCode = 1;
  }
  for (const { table, row } of apiRows) {
    try {
      const { json } = await fetchApi('/api/upsert', JSON.stringify({
        table, row, onConflict: table === 'ari_store' ? 'key' : 'id',
      }), { 'content-type': 'application/json' });
      if (json.error) throw new Error(json.error);
      console.log(`  ok    raksasa ${table}: ${JSON.stringify(row.id ?? row.key).slice(0, 60)}`);
    } catch (e) {
      console.error(`  GAGAL baris raksasa ${table}: ${e instanceof Error ? e.message : String(e)}`);
      process.exitCode = 1;
    }
  }
}

// ---------- Ringkasan ----------
console.log(`\nSelesai: ${Object.values(counts).reduce((a, b) => a + b, 0)} baris → D1 (${modeArg.slice(2)}).`);
for (const [t, c] of Object.entries(counts)) console.log(`  ${t.padEnd(32)} ${c}`);
console.log('Bandingkan dengan _ringkasan.json dari export (jumlah baris harus sama).');
