// Self-check aturan pencocokan filter divisi. Jalankan: npx tsx src/divisionFilter.check.ts
import assert from 'node:assert/strict';
import { matchesDivision } from './components/DivisionFilter';
import { divisionLabel } from './types';

const EVA = 'dept-eva-foam';
const KONVEKSI = 'dept-konveksi';

// Tanpa filter, semua lolos
assert.equal(matchesDivision(EVA, ''), true);
assert.equal(matchesDivision(undefined, ''), true);

// Filter satu divisi
assert.equal(matchesDivision(EVA, EVA), true);
assert.equal(matchesDivision(KONVEKSI, EVA), false);

// Data tanpa divisi: biaya bersama punya ember sendiri, tidak bocor ke divisi lain
assert.equal(matchesDivision(undefined, EVA), false);
assert.equal(matchesDivision(undefined, 'shared'), true);
assert.equal(matchesDivision(EVA, 'shared'), false);

// Bahan Umum sebaliknya: memang dipakai kedua divisi, jadi selalu ikut tampil
assert.equal(matchesDivision(undefined, EVA, 'match-all'), true);
assert.equal(matchesDivision(undefined, KONVEKSI, 'match-all'), true);
assert.equal(matchesDivision(KONVEKSI, EVA, 'match-all'), false);

// Label
assert.equal(divisionLabel(EVA), 'Eva Foam');
assert.equal(divisionLabel(KONVEKSI), 'Konveksi');
assert.equal(divisionLabel(undefined), 'Umum');
assert.equal(divisionLabel(undefined, 'Bersama'), 'Bersama');
assert.equal(divisionLabel('dept-entah', 'Bersama'), 'Bersama');

console.log('OK: aturan filter divisi');
