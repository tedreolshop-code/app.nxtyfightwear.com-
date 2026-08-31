// Self-check gabung sinkron bertahap. Jalankan: npx tsx src/cloudSync.check.ts
import assert from 'node:assert/strict';
import { mergeRowsById } from './cloudSync';

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

console.log('cloudSync.check.ts: OK');
