// Self-check metrik scan pulang — dipakai scan normal maupun koreksi admin.
// Jalankan: npx tsx src/checkoutMetrics.check.ts
import assert from 'node:assert/strict';
import { checkoutMetrics } from './types';
import type { Attendance, WorkSettings } from './types';

const settings = { start_time: '08:00', end_time: '16:00', full_day_from: '14:00', half_day_start: '12:00' } as WorkSettings;
const masuk = (jam: string, late = 0): Attendance =>
  ({ timestamp: `2026-08-22T${jam}:00+07:00`, late_minutes: late } as Attendance);

// === Aturan baru: lembur berbasis JAM PENGAJUAN, toleransi lewat batas 10 menit ===
// Pengajuan 1 jam (60 menit): batas pulang = 16:00 + 60 m + 10 m = 17:10.

// Pengajuan 1 jam, pulang tepat 17:00 → 1 jam penuh.
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:00:00+07:00', settings, true, 60).overtime_minutes, 60);
// Pengajuan 1 jam, pulang 17:05 → tetap 1 jam (toleransi 10 menit).
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:05:00+07:00', settings, true, 60).overtime_minutes, 60);
// Pengajuan 1 jam, pulang 17:10 → tetap 1 jam (tepat di batas toleransi).
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:10:00+07:00', settings, true, 60).overtime_minutes, 60);
// Pengajuan 1 jam, pulang 17:15 → lewat 5 menit dari batas → usulan pengajuan + 1 jam
// (kandidat 2 jam); admin memutuskan lewat review.
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:15:00+07:00', settings, true, 60).overtime_minutes, 120);

// Pengajuan 2 jam (batas 18:10): pulang 18:00 → 2 jam; pulang 18:10 → tetap 2 jam;
// pulang 18:15 → usulan 3 jam (kandidat jam berikutnya).
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T18:00:00+07:00', settings, true, 120).overtime_minutes, 120);
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T18:10:00+07:00', settings, true, 120).overtime_minutes, 120);
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T18:15:00+07:00', settings, true, 120).overtime_minutes, 180);

// Tidak ada pengajuan → tidak ada lembur otomatis, walau pulang larut.
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T18:00:00+07:00', settings).overtime_minutes, 0);
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T18:00:00+07:00', settings, true, 0).overtime_minutes, 0);

// Keterlambatan pagi ditutup dulu: telat 30 menit, pengajuan 2 jam, pulang 18:00
// (pas batas 2 jam) → 30 menit jadi pengganti telat, sisanya 90 menit lembur.
const lembur = checkoutMetrics(masuk('08:30', 30), '2026-08-22T18:00:00+07:00', settings, true, 120);
assert.equal(lembur.late_compensation_minutes, 30);
assert.equal(lembur.overtime_minutes, 90);

// Pulang cepat tetap terdeteksi: sebelum 14:00 = setengah hari.
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T12:20:00+07:00', settings).work_fraction, 0.5);

// Kompatibilitas: pemanggilan lama tanpa jam pengajuan tetap aman (tanpa pengajuan = 0).
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:00:00+07:00', settings).overtime_minutes, 0);

console.log('OK: metrik scan pulang (aturan berbasis jam pengajuan, toleransi 10 menit)');
