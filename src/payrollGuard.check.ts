// Self-check guard anti dobel-bayar slip gaji mingguan.
// Jalankan: npx tsx src/payrollGuard.check.ts
import assert from 'node:assert/strict';
import { weeklyPeriodEnd, payrollPeriodsOverlap, dedupePayrollRows } from './dataStore';
import type { PayrollWeekly } from './types';

const slip = (over: Partial<PayrollWeekly>): PayrollWeekly => ({
  id: 'p1', employee_id: 'emp-asep', employee_name: 'Asep', period_start: '2026-08-01',
  period_end: '2026-08-07', days_worked: 6, overtime_hours: 0, base_pay: 900000,
  bonus: 0, cash_advance_deduction: 0, total_pay: 900000, is_printed: false,
  payment_status: 'unpaid', ...over,
});

// Normalisasi akhir periode: Sabtu (hari bayar) mundur ke Jumat.
{
  assert.equal(weeklyPeriodEnd('2026-08-08'), '2026-08-07', 'Sabtu 8 Agu 2026 harus Jumat 7 Agu');
  assert.equal(weeklyPeriodEnd('2026-08-07'), '2026-08-07', 'Jumat tidak digeser');
  assert.equal(weeklyPeriodEnd('2026-08-09'), '2026-08-09', 'Hari lain tidak digeser');
  console.log('OK: weeklyPeriodEnd — Sabtu dikoreksi ke Jumat');
}

// Irisan: tepi periode berbeda tapi menimpa hari kerja yang sama.
{
  const dasar = { period_start: '2026-08-01', period_end: '2026-08-07' };
  // Beririsan sebagian: 3–9 Agu menimpa 3–7 Agu.
  assert.ok(payrollPeriodsOverlap(dasar, { period_start: '2026-08-03', period_end: '2026-08-09' }), 'irisan sebagian harus terdeteksi');
  // Tepi sama, tetap irisan.
  assert.ok(payrollPeriodsOverlap(dasar, { period_start: '2026-08-07', period_end: '2026-08-13' }), 'menyentuh di tepi Jumat = irisan');
  // Salip penuh.
  assert.ok(payrollPeriodsOverlap(dasar, { period_start: '2026-07-26', period_end: '2026-08-14' }), 'salip penuh = irisan');
  // Tidak irisan sama sekali.
  assert.ok(!payrollPeriodsOverlap(dasar, { period_start: '2026-08-08', period_end: '2026-08-14' }), 'periode setelahnya tidak irisan');
  assert.ok(!payrollPeriodsOverlap(dasar, { period_start: '2026-07-19', period_end: '2026-07-25' }), 'periode sebelumnya tidak irisan');
  // Slip lama tersimpan dengan akhir Sabtu (Jumat + hari bayar): setelah
  // dinormalkan ia beririsan dengan minggu yang sama, tapi tidak dengan minggu berikutnya.
  const legacy = { period_start: '2026-08-07', period_end: '2026-08-08' };
  assert.ok(payrollPeriodsOverlap(dasar, legacy), 'Jumat dobel dengan minggu yang sama → irisan');
  assert.ok(!payrollPeriodsOverlap({ period_start: '2026-08-08', period_end: '2026-08-14' }, legacy), 'Sabtu 8 Agu bukan hari kerja slip lama → tidak irisan dengan minggu berikutnya');
  console.log('OK: payrollPeriodsOverlap — irisan sebagian, tepi, salip, dan slip akhir-Sabtu lama');
}

// Dedup titik baca: duplikat muncul kalau dua perangkat menerbitkan periode
// yang sama sebelum cloud sync bergabung (id-nya beda, isi mirip).
{
  // Yang lunas menang atas yang belum lunas.
  const d1 = dedupePayrollRows([
    slip({ id: 'a' }),
    slip({ id: 'b', payment_status: 'paid', period_end: '2026-08-08' }), // akhir Sabtu, sama periode
  ]);
  assert.deepEqual(d1.kept.map(p => p.id), ['b'], 'slip lunas harus dipertahankan');
  assert.equal(d1.dupes, 1);

  // Sama-sama lunas / sama-sama belum: id terkecil menang — deterministik di semua perangkat.
  const d2 = dedupePayrollRows([slip({ id: 'z9' }), slip({ id: 'a1' })]);
  assert.deepEqual(d2.kept.map(p => p.id), ['a1'], 'id terkecil harus menang');

  const d3 = dedupePayrollRows([
    slip({ id: 'm2', payment_status: 'paid' }),
    slip({ id: 'k1', payment_status: 'paid' }),
  ]);
  assert.deepEqual(d3.kept.map(p => p.id), ['k1'], 'dua slip lunas: id terkecil menang');

  // Beda karyawan atau beda periode tidak ikut terbuang.
  const d4 = dedupePayrollRows([
    slip({ id: 'a' }),
    slip({ id: 'b', employee_id: 'emp-budi', employee_name: 'Budi' }),
    slip({ id: 'c', period_start: '2026-08-08', period_end: '2026-08-14' }),
  ]);
  assert.deepEqual(d4.kept.map(p => p.id), ['a', 'b', 'c']);
  assert.equal(d4.dupes, 0, 'baris berbeda periode/karyawan bukan duplikat');

  // Urutan asli baris yang dipertahankan tidak berubah.
  const d5 = dedupePayrollRows([slip({ id: 'a' }), slip({ id: 'x', employee_id: 'emp-budi', employee_name: 'Budi' }), slip({ id: 'a2' })]);
  assert.deepEqual(d5.kept.map(p => p.id), ['a', 'x'], 'urutan baris lain harus tetap');
  assert.equal(d5.dupes, 1);
  console.log('OK: dedupePayrollRows — lunas menang, id terkecil deterministik, baris lain utuh');
}
