// Self-check hitungan hari kerja sebulan (Minggu libur).
// Jalankan: npx tsx src/workingDays.check.ts
import assert from 'node:assert/strict';
import { workingDaysInMonth } from './types';

// Juli 2026: 31 hari, mulai Rabu. Minggu jatuh pada 5, 12, 19, 26 → 4 hari libur.
assert.equal(workingDaysInMonth('2026-07'), 27);

// Februari 2026: 28 hari, Minggu pada 1, 8, 15, 22 → 4 hari libur.
assert.equal(workingDaysInMonth('2026-02'), 24);

// Februari 2028 kabisat: 29 hari, Minggu pada 6, 13, 20, 27 → 4 hari libur.
assert.equal(workingDaysInMonth('2028-02'), 25);

// Tidak pernah melebihi jumlah hari dalam bulan, dan selalu masuk akal
for (const month of ['2026-01', '2026-04', '2026-06', '2026-12']) {
  const days = workingDaysInMonth(month);
  assert.ok(days >= 24 && days <= 27, `${month}: ${days} di luar rentang wajar`);
}

console.log('OK: hitungan hari kerja sebulan');
