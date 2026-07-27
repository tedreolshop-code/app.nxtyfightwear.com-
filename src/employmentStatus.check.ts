// Self-check hak bonus kehadiran per status kepegawaian.
// Jalankan: npx tsx src/employmentStatus.check.ts
import assert from 'node:assert/strict';
import { employmentStatusOf, isEligibleForAttendanceBonus } from './types';

// Data lama tanpa status dianggap sudah karyawan, supaya bonus yang sudah berjalan
// tidak tiba-tiba gugur setelah fitur ini dipasang.
assert.equal(employmentStatusOf(undefined), 'karyawan');
assert.equal(employmentStatusOf({}), 'karyawan');
assert.equal(isEligibleForAttendanceBonus({}), true);

assert.equal(employmentStatusOf({ employment_status: 'training' }), 'training');
assert.equal(isEligibleForAttendanceBonus({ employment_status: 'training' }), false);
assert.equal(isEligibleForAttendanceBonus({ employment_status: 'karyawan' }), true);

console.log('OK: hak bonus kehadiran per status kepegawaian');
