// Cadangan D1 (Cloudflare) ke berkas SQL lokal — rutinitas sebelum payroll.
//
//   npm run backup:d1            (remote, butuh wrangler login)
//   npm run backup:d1 -- --local (database lokal dev)
//
// Hasil: backup-d1/<timestamp>/dump.sql (schema + seluruh data)
// Restore: cd server && npx wrangler d1 execute ari-store --remote --file <dump.sql>
// Saran: jalankan tiap JUMAT pagi sebelum generate gaji mingguan.

import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const mode = process.argv.includes('--local') ? '--local' : '--remote';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = join('backup-d1', stamp);
await mkdir(dir, { recursive: true });

const file = join(dir, 'dump.sql');
// d1 export menulis dump SQL lengkap (schema + data) dalam satu perintah.
execFileSync('npx', ['wrangler', 'd1', 'export', 'ari-store', mode,
  '--output', join(process.cwd(), file)],
  { cwd: 'server', stdio: 'inherit' });

console.log(`\nSelesai: ${file}`);
console.log('Restore : cd server && npx wrangler d1 execute ari-store --remote --file <dump.sql>');
