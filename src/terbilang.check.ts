// Self-check terbilang rupiah (dipakai slip gaji).
// Jalankan: npx tsx src/terbilang.check.ts
import assert from 'node:assert/strict';
import { terbilang } from './types';

assert.equal(terbilang(0), 'nol rupiah');
assert.equal(terbilang(7), 'tujuh rupiah');
assert.equal(terbilang(11), 'sebelas rupiah');       // bukan "satu belas"
assert.equal(terbilang(15), 'lima belas rupiah');
assert.equal(terbilang(21), 'dua puluh satu rupiah');
assert.equal(terbilang(100), 'seratus rupiah');      // bukan "satu ratus"
assert.equal(terbilang(150), 'seratus lima puluh rupiah');
assert.equal(terbilang(1000), 'seribu rupiah');      // bukan "satu ribu"
assert.equal(terbilang(2000), 'dua ribu rupiah');
assert.equal(terbilang(910000), 'sembilan ratus sepuluh ribu rupiah');
assert.equal(terbilang(1500000), 'satu juta lima ratus ribu rupiah');
assert.equal(terbilang(-50000), 'minus lima puluh ribu rupiah');

// Tidak pernah menyisakan spasi ganda atau spasi di tepi
for (const n of [0, 11, 105, 1001, 20000, 999999999, 1234567890]) {
  const teks = terbilang(n);
  assert.equal(teks, teks.trim());
  assert.ok(!teks.includes('  '), `spasi ganda pada ${n}: "${teks}"`);
}

console.log('terbilang.check.ts: OK');
