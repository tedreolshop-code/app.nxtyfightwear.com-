// Self-check aturan divisi bahan baku. Jalankan: npx tsx src/materialDivision.check.ts
import assert from 'node:assert/strict';
import { materialDivisionLabel } from './types';

assert.equal(materialDivisionLabel({ department_id: 'dept-eva-foam' }), 'Eva Foam');
assert.equal(materialDivisionLabel({ department_id: 'dept-konveksi' }), 'Konveksi');
assert.equal(materialDivisionLabel({}), 'Umum'); // tanpa divisi = dipakai keduanya
assert.equal(materialDivisionLabel(undefined), 'Umum');
// Nama tidak lagi menentukan divisi (dulu 'foam' di ID dipaksa jadi Eva Foam)
assert.equal(materialDivisionLabel({ department_id: undefined }), 'Umum');

// Aturan filter: bahan Umum ikut tampil di kedua divisi
const matches = (dept: 'all' | 'eva' | 'konveksi', material: { department_id?: string }) => {
  if (dept === 'all') return true;
  const div = materialDivisionLabel(material);
  if (div === 'Umum') return true;
  return dept === 'eva' ? div === 'Eva Foam' : div === 'Konveksi';
};

const eva = { department_id: 'dept-eva-foam' };
const konveksi = { department_id: 'dept-konveksi' };
const umum = {};

assert.equal(matches('eva', eva), true);
assert.equal(matches('eva', konveksi), false);
assert.equal(matches('konveksi', eva), false);
assert.equal(matches('konveksi', konveksi), true);
assert.equal(matches('eva', umum), true);
assert.equal(matches('konveksi', umum), true);
assert.equal(matches('all', konveksi), true);

console.log('OK: aturan divisi bahan baku');
