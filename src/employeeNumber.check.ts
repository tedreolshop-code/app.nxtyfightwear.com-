// Self-check penomoran induk karyawan.
// Jalankan: npx tsx src/employeeNumber.check.ts
import assert from 'node:assert/strict';
import { departmentCode, nextEmployeeNumber } from './types';

// Kode divisi: tanpa spasi, tanpa kata "Departemen"
assert.equal(departmentCode('Departemen Konveksi'), 'KONVEKSI');
assert.equal(departmentCode('Eva Foam'), 'EVAFOAM');
assert.equal(departmentCode(undefined), 'UMUM');

// Divisi kosong mulai dari 001
assert.equal(nextEmployeeNumber([], 'Departemen Konveksi'), 'AR-KONVEKSI-001');

// Urut per divisi: Eva Foam tidak terpengaruh isi Konveksi
const daftar = [
  { employee_number: 'AR-KONVEKSI-001' },
  { employee_number: 'AR-KONVEKSI-002' },
  { employee_number: 'AR-EVAFOAM-001' },
];
assert.equal(nextEmployeeNumber(daftar, 'Departemen Konveksi'), 'AR-KONVEKSI-003');
assert.equal(nextEmployeeNumber(daftar, 'Eva Foam'), 'AR-EVAFOAM-002');

// Nomor karyawan keluar tidak dipakai ulang: yang tertinggi tetap jadi acuan
// walau nomor di tengah kosong (mis. 002 sudah keluar dan datanya terhapus).
assert.equal(nextEmployeeNumber([{ employee_number: 'AR-KONVEKSI-007' }], 'Departemen Konveksi'), 'AR-KONVEKSI-008');

// Nomor rusak/asing tidak merusak hitungan
assert.equal(nextEmployeeNumber([{ employee_number: 'AR-KONVEKSI-abc' }, { employee_number: 'LAIN-001' }, {}], 'Departemen Konveksi'), 'AR-KONVEKSI-001');

console.log('OK: penomoran induk karyawan');
