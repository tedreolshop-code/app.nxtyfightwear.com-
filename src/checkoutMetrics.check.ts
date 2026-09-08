// Self-check metrik scan pulang — dipakai scan normal maupun koreksi admin.
// Jalankan: npx tsx src/checkoutMetrics.check.ts
import assert from 'node:assert/strict';
import { checkoutMetrics } from './types';
import type { Attendance, WorkSettings } from './types';

const settings = { start_time: '08:00', end_time: '16:00', full_day_from: '14:00', half_day_start: '12:00', overtime_tolerance_minutes: 0 } as WorkSettings;
const masuk = (jam: string, late = 0): Attendance =>
  ({ timestamp: `2026-08-22T${jam}:00+07:00`, late_minutes: late } as Attendance);

// Pulang 17:00 tanpa pengajuan lembur: hari penuh, tidak ada lembur otomatis.
const sore = checkoutMetrics(masuk('07:51'), '2026-08-22T17:00:00+07:00', settings);
assert.equal(sore.work_fraction, 1);
assert.equal(sore.overtime_minutes, 0);
assert.equal(sore.worked_minutes, 549);

// Ajukan lembur, pulang 17:00 → 60 menit lewat 16:00 → dibulatkan ke 60 menit (1 jam).
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:00:00+07:00', settings, true).overtime_minutes, 60);

// Pengajuan + pulang 16:05 (dalam toleransi 0 menit) → 5 menit → dibulatkan ke 30 menit.
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T16:05:00+07:00', settings, true).overtime_minutes, 30);

// Pengajuan + pulang 16:35 → 35 menit → dibulatkan ke 60 menit.
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T16:35:00+07:00', settings, true).overtime_minutes, 60);

// Pengajuan + pulang 17:30 → 90 menit → dibulatkan ke 90 menit (1.5 jam).
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T17:30:00+07:00', settings, true).overtime_minutes, 90);

// Pulang sebelum 14:00 = setengah hari.
assert.equal(checkoutMetrics(masuk('07:51'), '2026-08-22T12:20:00+07:00', settings).work_fraction, 0.5);

// Telat 30 menit ditutup dulu: pulang 18:30 → dari 16:00 ada 150 menit, sisa 120 menit → dibulatkan ke 120 menit (2 jam).
const lembur = checkoutMetrics(masuk('08:30', 30), '2026-08-22T18:30:00+07:00', settings, true);
assert.equal(lembur.late_compensation_minutes, 30);
assert.equal(lembur.overtime_minutes, 120);

console.log('OK: metrik scan pulang');
