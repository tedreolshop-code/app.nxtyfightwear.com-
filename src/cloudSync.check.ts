// Self-check gabung sinkron bertahap. Jalankan: npx tsx src/cloudSync.check.ts
import assert from 'node:assert/strict';
import { mergeRowsById, compactAttendanceRows, trimRowsByAge, missingLocalIdsWithAge, trimAttendanceRows, markTombstones, unmarkTombstones, nisanFor, pruneNisan, mergeStoreValue, localStoreView } from './cloudSync';

// Stub localStorage (cloudSync membaca/menulis key di sini saat nisan dipasang).
const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};

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

// Trim absensi 90 hari: bulan yang di-pin & baris koreksi tetap disimpan.
{
  const HARI = 86400000;
  const pinned = new Set(['2026-04']);
  const rows = [
    { id: 'lama', timestamp: new Date(Date.now() - 200 * HARI).toISOString() },
    { id: 'pin', timestamp: '2026-04-10T07:00:00+07:00' },
    { id: 'koreksi', timestamp: new Date(Date.now() - 200 * HARI).toISOString(), device_token: 'koreksi-admin' },
    { id: 'baru', timestamp: new Date(Date.now() - HARI).toISOString() },
    { id: 'rusak', timestamp: 'bukan-tanggal' },
  ];
  const kept = trimAttendanceRows(rows, Date.now() - 90 * HARI, pinned);
  assert.deepEqual(kept.map(r => r.id), ['pin', 'koreksi', 'baru', 'rusak'], 'hanya yang tua & tidak dipin dilepas');
}

// Nisan: id yang ditandai tidak dibangkitkan ulang oleh heal/realtime.
{
  assert.equal(nisanFor('employees').size, 0, 'awalnya tidak ada nisan');
  markTombstones('employees', ['emp-budi', 'emp-siti']);
  assert.ok(nisanFor('employees').has('emp-budi') && nisanFor('employees').has('emp-siti'));
  assert.equal(nisanFor('orders').size, 0, 'nisan terpisah per key');
  // duplikat tidak membesarkan daftar
  markTombstones('employees', ['emp-budi']);
  assert.equal(nisanFor('employees').size, 2);
  // cabut = data dipulihkan
  unmarkTombstones('employees', ['emp-budi']);
  assert.ok(!nisanFor('employees').has('emp-budi'));
  assert.ok(nisanFor('employees').has('emp-siti'), 'nisan lain tetap');
}

// Nisan kedaluwarsa dibuang; kap maksimum dihormati.
{
  const now = Date.now();
  const rows = [
    { k: 'orders', i: 'a', t: now - 91 * 86400000 },
    { k: 'orders', i: 'b', t: now },
  ];
  assert.deepEqual(pruneNisan(rows).map(n => n.i), ['b'], 'nisan >90 hari dibuang');
  const banyak = Array.from({ length: 3000 }, (_, idx) => ({ k: 'orders', i: `i${idx}`, t: now }));
  assert.equal(pruneNisan(banyak).length, 2000, 'kap 2000 baris nisan');
}

// Nisan absensi: key lama & generik tergabung.
{
  markTombstones('attendance', ['scan-1']);
  store.set('nxty_attendance_tombstones', JSON.stringify(['scan-2']));
  // readTombstones memadukan keduanya — dicek lewat efek: lookup nisan generik
  // 'attendance' mengembalikan keduanya.
  assert.ok(nisanFor('attendance').has('scan-1'));
}

// Merge ari_store: audit log di-GABUNG, bukan ditimpa.
{
  const lama = Date.now() - 40 * 86400000;
  const remote = [
    { id: 'a1', timestamp: new Date(lama).toISOString() },
    { id: 'a2', timestamp: new Date(lama + 1000).toISOString() },
  ];
  const local = [{ id: 'a3', timestamp: new Date().toISOString() }];
  const merged = mergeStoreValue('audit_logs', remote, local) as Array<{ id: string }>;
  assert.equal(merged.map(r => r.id).sort().join(','), 'a1,a2,a3', 'remote + lokal tergabung');
  // tampilan lokal hanya 30 hari terakhir — riwayat lama tetap di cloud
  const view = localStoreView('audit_logs', merged) as Array<{ id: string }>;
  assert.deepEqual(view.map(r => r.id), ['a3'], 'audit lokal dipangkas ke 30 hari');
}

// Merge recycle bin: entri nisan (hapus permanen) & kedaluwarsa dibuang.
{
  markTombstones('recycle_bin', ['employees:emp-x']);
  const remote = [
    { id: 'employees:emp-x', deleted_at: new Date().toISOString(), expires_at: new Date(Date.now() + 10 * 86400000).toISOString() },
    { id: 'orders:o1', deleted_at: new Date().toISOString(), expires_at: new Date(Date.now() + 10 * 86400000).toISOString() },
    { id: 'orders:o2', deleted_at: new Date().toISOString(), expires_at: new Date(Date.now() - 10 * 86400000).toISOString() }, // kedaluwarsa
  ];
  const merged = mergeStoreValue('recycle_bin', remote, []) as Array<{ id: string }>;
  assert.deepEqual(merged.map(r => r.id), ['orders:o1'], 'nisan & kadaluwarsa dibuang');
}

// Merge nisan: remote + lokal tergabung.
{
  const now = Date.now();
  const merged = mergeStoreValue('deletion_tombstones', [{ k: 'orders', i: 'a', t: now }], [{ k: 'orders', i: 'b', t: now }]);
  assert.equal(pruneNisan(merged as never).length, 2);
}

console.log('cloudSync.check.ts: OK');
