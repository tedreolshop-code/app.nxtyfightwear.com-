// Self-check metrik scan pulang — dipakai scan normal maupun koreksi admin.
// Jalankan: npx tsx src/checkoutMetrics.check.ts
import assert from 'node:assert/strict';
import { checkoutMetrics } from './types';
import type { Attendance, WorkSettings } from './types';

const settings = { start_time: '08:00', end_time: '16:00', full_day_from: '14:00', half_day_start: '12:00' } as WorkSettings;
const masuk = (jam: string, late = 0): Attendance =>
  ({ timestamp: `2026-08-22T${jam}:00+07:00`, late_minutes: late } as Attendance);

// === Aturan: usulan lembur = PERSIS jam pengajuan; admin memutuskan di Perlu Review ===

// Pengajuan 1 jam: pulang 17:00 / 17:05 / 17:10 / 17:15 → usulan selalu 1 jam.
// (Tidak ada eskalasi +1 jam; lebih/kurang dari pengajuan diputuskan admin.)
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:00:00+07:00', settings, true, 60).overtime_minutes, 60);
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:05:00+07:00', settings, true, 60).overtime_minutes, 60);
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:10:00+07:00', settings, true, 60).overtime_minutes, 60);
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:15:00+07:00', settings, true, 60).overtime_minutes, 60);

// Pengajuan 2 jam: pulang 18:00 / 18:10 / 18:15 / 18:30 → usulan selalu 2 jam.
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T18:00:00+07:00', settings, true, 120).overtime_minutes, 120);
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T18:10:00+07:00', settings, true, 120).overtime_minutes, 120);
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T18:15:00+07:00', settings, true, 120).overtime_minutes, 120);
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T18:30:00+07:00', settings, true, 120).overtime_minutes, 120);

// Tidak ada pengajuan → tidak ada lembur otomatis, walau pulang larut.
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T18:00:00+07:00', settings).overtime_minutes, 0);
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T18:00:00+07:00', settings, true, 0).overtime_minutes, 0);

// Keterlambatan pagi ditutup dulu: telat 30 menit, pengajuan 2 jam, pulang 18:00
// → 30 menit jadi pengganti telat, sisanya 90 menit lembur.
const lembur = checkoutMetrics(masuk('08:30', 30), '2026-08-22T18:00:00+07:00', settings, true, 120);
assert.equal(lembur.late_compensation_minutes, 30);
assert.equal(lembur.overtime_minutes, 90);

// Pulang cepat tetap terdeteksi: sebelum 14:00 = setengah hari.
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T12:20:00+07:00', settings).work_fraction, 0.5);

// Kompatibilitas: pemanggilan lama tanpa jam pengajuan tetap aman (tanpa pengajuan = 0).
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:00:00+07:00', settings).overtime_minutes, 0);

console.log('OK: metrik scan pulang (usulan = persis jam pengajuan; admin memutuskan di review)');
