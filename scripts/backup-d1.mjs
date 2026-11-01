// Cadangan D1 (Cloudflare) ke berkas JSON lokal — untuk rutinitas sebelum payroll.
//
//   node scripts/backup-d1.mjs            (remote, butuh wrangler login)
//   node scripts/backup-d1.mjs --local    (database lokal dev)
//
// Hasil: backup-d1/<timestamp>/<tabel>.json + _ringkasan.json
// Saran: jalankan tiap JUMAT pagi sebelum generate gaji mingguan.

import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

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

const mode = process.argv.includes('--local') ? '--local' : '--remote';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = join('backup-d1', stamp);
await mkdir(dir, { recursive: true });

// wrangler harus jalan dari folder server (wrangler.toml di sana).
const wr = (args) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'ari-store',
  mode, ...args, '-y'], { encoding: 'utf8', cwd: 'server', shell: true,
  stdio: ['ignore', 'pipe', 'inherit'] });

const query = async (sql) => {
  const out = wr(['--json', '--command', sql]);
  const m = out.lastIndexOf('[');
  return JSON.parse(out.slice(m));
};

let gagal = 0;
let total = 0;
for (const table of TABLES) {
  try {
    const rows = [];
    const PAGE = 900;
    for (let off = 0; ; off += PAGE) {
      const res = await query(`SELECT * FROM ${table} LIMIT ${PAGE} OFFSET ${off}`);
      rows.push(...res[0].results);
      if (res[0].results.length < PAGE) break;
    }
    await writeFile(join(dir, `${table}.json`), JSON.stringify(rows));
    total += rows.length;
    console.log(`  ok    ${table.padEnd(32)} ${rows.length} baris`);
  } catch (e) {
    gagal++;
    console.error(`  GAGAL ${table.padEnd(32)} ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  }
}

await writeFile(join(dir, '_ringkasan.json'), JSON.stringify({
  dibuat_pada: new Date().toISOString(),
  mode,
  jumlah_baris: total,
  tabel_gagal: gagal,
}, null, 2));

console.log(`\nSelesai: ${total} baris → ${dir}`);
if (gagal > 0) { console.error(`${gagal} tabel gagal — jalankan ulang.`); process.exit(1); }
