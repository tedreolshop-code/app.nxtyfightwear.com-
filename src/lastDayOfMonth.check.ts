// Self-check tanggal akhir bulan (dipakai filter bawaan "bulan berjalan").
// Jalankan: npx tsx src/lastDayOfMonth.check.ts
import assert from 'node:assert/strict';
import { lastDayOfMonth } from './types';

assert.equal(lastDayOfMonth('2026-08-22'), '2026-08-31'); // 31 hari
assert.equal(lastDayOfMonth('2026-04-01'), '2026-04-30'); // 30 hari
assert.equal(lastDayOfMonth('2026-02-10'), '2026-02-28'); // Februari biasa
assert.equal(lastDayOfMonth('2028-02-10'), '2028-02-29'); // Februari kabisat
assert.equal(lastDayOfMonth('2026-12-31'), '2026-12-31'); // Desember, batas tahun

// Selalu >= tanggal masukan dan tetap di bulan yang sama
for (const tgl of ['2026-01-15', '2026-06-30', '2027-11-01']) {
  assert.ok(lastDayOfMonth(tgl) >= tgl);
  assert.equal(lastDayOfMonth(tgl).slice(0, 7), tgl.slice(0, 7));
}

console.log('lastDayOfMonth.check.ts: OK');
