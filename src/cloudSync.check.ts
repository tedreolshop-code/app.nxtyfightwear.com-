// Self-check gabung sinkron bertahap. Jalankan: npx tsx src/cloudSync.check.ts
import assert from 'node:assert/strict';
import { mergeRowsById, compactAttendanceRows, trimRowsByAge, missingLocalIdsWithAge } from './cloudSync';

type R = { id: string; v: number };
const ids = (rows: R[]) => rows.map(r => r.id).sort().join(',');

// Baris berubah menang, baris lokal lain dipertahankan.
{
  const local: R[] = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }];
  const changed: R[] = [{ id: 'b', v: 2 }];
  const merged = mergeRowsById(changed, local, new Set(['a', 'b', 'c']));
  assert.equal(ids(merged), 'a,b,c');
  assert.equal(merged.find(r => r.id === 'b')!.v, 2, 'baris berubah harus versi cloud');
}

// Baris yang hilang dari cloudIds = dihapus → dibuang.
{
  const local: R[] = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }];
  const merged = mergeRowsById([], local, new Set(['a'])); // b tidak ada di cloud
  assert.equal(ids(merged), 'a');
}

// cloudIds kosong / null → JANGAN buang apa pun (tabel data bawaan aplikasi).
{
  const local: R[] = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }];
  assert.equal(ids(mergeRowsById([], local, new Set())), 'a,b');
  assert.equal(ids(mergeRowsById([], local, null)), 'a,b');
}

// Baris baru dari cloud ikut masuk.
{
  const local: R[] = [{ id: 'a', v: 1 }];
  const merged = mergeRowsById([{ id: 'x', v: 9 }], local, new Set(['a', 'x']));
  assert.equal(ids(merged), 'a,x');
}

// Tidak ada duplikat kalau id berubah muncul di local & changed.
{
  const local: R[] = [{ id: 'a', v: 1 }, { id: 'a', v: 1 }];
  const merged = mergeRowsById([{ id: 'a', v: 2 }], local, new Set(['a']));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].v, 2);
}

// Perawatan storage: kompaksi absensi lama tanpa menyentuh baris koreksi/baru.
{
  const now = Date.now();
  const HARI = 86400000;
  const dasar = { employee_id: 'e1', employee_name: 'Budi', type_scan: 'masuk', status: 'normal' };
  const lama = { ...dasar, id: 'a1', timestamp: new Date(now - 90 * HARI).toISOString(), latitude: -6.8, longitude: 107.6, device_token: 'device-x', verification_method: 'gps_self', selfie_url: '', overtime_request: { reason: 'x' }, is_mock_location_flag: false };
  const koreksi = { ...lama, id: 'a2', device_token: 'koreksi-admin' };
  const baru = { ...lama, id: 'a3', timestamp: new Date(now - HARI).toISOString() };
  const { rows: hasil, compacted } = compactAttendanceRows([lama, koreksi, baru], now - 30 * HARI);
  assert.equal(compacted, 1, 'hanya 1 baris yang dikompaksi');
  assert.ok(!('latitude' in hasil[0]) && !('device_token' in hasil[0]), 'field gemuk dibuang dari baris lama');
  assert.equal(hasil[0].employee_name, 'Budi', 'inti data tetap ada');
  assert.equal(hasil[0].status, 'normal', 'status tetap ada');
  assert.ok('latitude' in hasil[1], 'baris koreksi tidak disentuh');
  assert.ok('latitude' in hasil[2], 'baris baru tidak disentuh');
}

// Trim usia: baris tua dilepas, tanpa tanggal disimpan (konservatif).
{
  const rows = [
    { id: 'x1', created_at: new Date(Date.now() - 100 * 86400000).toISOString() },
    { id: 'x2', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'x3' },
  ];
  const kept = trimRowsByAge(rows, 'created_at', Date.now() - 90 * 86400000);
  assert.deepEqual(kept.map(r => r.id), ['x2', 'x3'], 'trim menyisakan yang baru & tanpa tanggal');
}

// Watermark pemangkasan: id lama tidak dianggap hilang, id baru tetap di-refill.
{
  const map = new Map([
    ['lama', new Date(Date.now() - 200 * 86400000).toISOString()],
    ['baru', new Date().toISOString()],
    ['rusak', 'bukan-tanggal'],
  ]);
  const missing = missingLocalIdsWithAge(new Set(['ada']), map, Date.now() - 180 * 86400000);
  assert.deepEqual(missing.sort(), ['baru', 'rusak'], 'id dalam watermark dilewati, id baru/tak-dikenal tetap ditarik');
  assert.equal(missingLocalIdsWithAge(new Set(), map, 0).length, 3, 'tanpa watermark semua dianggap hilang');
}

console.log('cloudSync.check.ts: OK');
