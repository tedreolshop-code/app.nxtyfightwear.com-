/**
 * Endpoint sinkron data generik: /api/q (SELECT subset postgrest-like) dan
 * /api/upsert (cermin builder .upsert supabase-js dengan onConflict/ignoreDuplicates).
 *
 * Keamanan: tabel & kolom dibatasi whitelist; filter hanya operator tetap; semua
 * nilai lewat parameter bind. Pembacaan terbuka (paritas policy RLS Supabase:
 * select untuk semua), penyisipan/perbaruan saja — penghapusan WAJIB lewat /api/d
 * (token+role, di auth.ts).
 */

import { Env, D1PreparedStatement, ApiResult, ok, fail } from './cf';
import {
  READABLE_TABLES, ROW_UPSERT_COLS, STORE_UPSERT_COLS,
  isSafeIdent, isSafeJsonPath,
} from './tables';

const UPSERT_CHUNK = 100;
// D1 membatasi 100 bind parameter per statement — daftar IN lebih besar dari ini
// dipecah otomatis menjadi beberapa query di handleQuery. MAX_FILTER_VALUES =
// batas keras satu request (diluar itu ditolak).
const IN_CHUNK = 90;
const MAX_FILTER_VALUES = 2000;

type Filter = { col: string; json?: string; op: string; value?: unknown; values?: unknown[] };

interface QueryBody {
  table?: unknown;
  columns?: unknown;
  filters?: unknown;
  limit?: unknown;
  offset?: unknown;
  single?: unknown;
}

/** Ekspresi kolom: identifier biasa atau json_extract(value, '$.path'). */
const colExpr = (f: { col: string; json?: string }): string =>
  f.json ? `json_extract(value, '$.${f.json}')` : f.col;

export const handleQuery = async (env: Env, body: QueryBody): Promise<ApiResult> => {
  const table = String(body.table ?? '');
  if (!READABLE_TABLES.includes(table)) return fail(`Tabel ${table} tidak dapat dibaca.`);

  const columns = (Array.isArray(body.columns) ? body.columns : []).filter(isSafeIdent) as string[];
  if (columns.length === 0) return fail('Kolom tidak valid.');

  const filters: Filter[] = [];
  if (Array.isArray(body.filters)) {
    for (const raw of body.filters as unknown[]) {
      if (!raw || typeof raw !== 'object') continue;
      const f = raw as Partial<Filter>;
      const op = String(f.op ?? '');
      if (!['eq', 'gt', 'gte', 'lte', 'in'].includes(op)) return fail(`Operator ${op} tidak didukung.`);
      if (!isSafeIdent(f.col)) return fail('Kolom filter tidak valid.');
      if (f.json && !isSafeJsonPath(f.json)) return fail('Path JSON tidak valid.');
      if (op === 'in') {
        // Adapter mengirim daftar di field `values` (terima juga `value` array
        // untuk kompatibilitas panggilan langsung).
        const rawList = Array.isArray(f.values) ? f.values : (Array.isArray(f.value) ? f.value : []);
        const values = rawList.filter((v): v is string | number => typeof v === 'string' || typeof v === 'number');
        if (values.length === 0 || values.length > MAX_FILTER_VALUES) return fail('Daftar IN tidak valid.');
        filters.push({ col: f.col, json: f.json ? String(f.json) : undefined, op, values });
      } else {
        filters.push({ col: f.col, json: f.json ? String(f.json) : undefined, op, value: f.value });
      }
    }
  }

  const limit = Number.isFinite(Number(body.limit))
    ? Math.min(Math.max(Number(body.limit), 1), 10_000)
    : null;
  const offset = Number.isFinite(Number(body.offset)) ? Math.max(Number(body.offset), 0) : 0;

  const buildSql = (inValues: unknown[]): { sql: string; params: unknown[] } => {
    const where: string[] = [];
    const params: unknown[] = [];
    for (const f of filters) {
      const expr = colExpr(f);
      if (f.op === 'in') {
        // Saat inFilter sedang dipecah, pakai grup nilai yang diberikan.
        const chunk = f === inFilter ? inValues : (f.values as unknown[]);
        const placeholders = chunk.map(() => '?').join(',');
        where.push(`${expr} IN (${placeholders})`);
        params.push(...chunk);
      } else {
        const sym = f.op === 'eq' ? '=' : f.op === 'gt' ? '>' : f.op === 'gte' ? '>=' : '<=';
        where.push(`${expr} ${sym} ?`);
        params.push(f.value);
      }
    }
    const parts = [`SELECT ${columns.join(', ')} FROM ${table}`];
    if (where.length > 0) parts.push(`WHERE ${where.join(' AND ')}`);
    // Urutan stabil antar halaman pagination (rowid baris yang di-upsert tetap).
    if (limit !== null) {
      parts.push('ORDER BY rowid');
      parts.push(`LIMIT ${limit} OFFSET ${offset}`);
    } else if (!body.single) {
      // Tanpa .range() → kembalikan SEMUA hasil yang lolos filter (paritas
      // PostgREST), dengan ceiling pengaman saja.
      parts.push('LIMIT 10000');
    } else {
      parts.push('LIMIT 1');
    }
    return { sql: parts.join(' '), params };
  };

  // D1 membatasi 100 bind parameter per statement — daftar IN besar dipecah
  // menjadi beberapa query lalu hasilnya digabung (urutan tetap by-group).
  const inFilter = filters.find(f => f.op === 'in' && (f.values?.length ?? 0) > IN_CHUNK);
  let allRows: Record<string, unknown>[] = [];
  if (inFilter) {
    const values = inFilter.values as unknown[];
    for (let i = 0; i < values.length; i += IN_CHUNK) {
      const group = values.slice(i, i + IN_CHUNK);
      const { sql, params } = buildSql(group);
      const rows = await env.DB.prepare(sql).bind(...params).all<Record<string, unknown>>();
      allRows.push(...(rows.results ?? []));
    }
  } else {
    const { sql, params } = buildSql([]);
    const rows = await env.DB.prepare(sql).bind(...params).all<Record<string, unknown>>();
    allRows = rows.results ?? [];
  }

  // Paritas JSONB PostgREST: kolom value dikirim kembali sebagai OBJEK (bukan teks
  // JSON) — klien (cloudSync) mengandalkan bentuk objek untuk merge store/tombstone.
  const parsed = allRows.map(row => {
    if (typeof row.value === 'string' && row.value.length > 0) {
      try { return { ...row, value: JSON.parse(row.value) }; } catch { return row; }
    }
    return row;
  });
  if (body.single) return ok(parsed.length > 0 ? parsed[0] : null);
  return ok(parsed);
};

// ===================== /api/version =====================

/** Stamp per tabel — klien bandingkan supaya tarik ringan bisa dilewati total.
 *  Nilai berformat `stamp:dels` — dels = penghitung kumulatif penghapusan;
 *  klien hanya perlu baca-ulang daftar ID bila dels berubah (audit 8 Nov:
 *  pemboros baca terbesar adalah pindai ID padahal tak ada yang terhapus). */
export const bumpStamp = async (env: Env, table: string, delsDelta = 0): Promise<void> => {
  try {
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO ari_sync_state (table_name, stamp, dels) VALUES (?, ?, ?) ' +
        'ON CONFLICT(table_name) DO UPDATE SET stamp=excluded.stamp, dels=ari_sync_state.dels + excluded.dels'
      ).bind(table, now, delsDelta),
      env.DB.prepare(
        "INSERT INTO ari_sync_state (table_name, stamp, dels) VALUES ('_global', ?, ?) " +
        'ON CONFLICT(table_name) DO UPDATE SET stamp=excluded.stamp, dels=ari_sync_state.dels + excluded.dels'
      ).bind(now, delsDelta),
    ]);
    // Peta lengkap disalin ke SATU baris '_map' — /api/version membaca 1 baris
    // saja (audit kuota: 20 perangkat × poll 60 dtk × 31 baris = 892 ribu baca/hari
    // kalau membaca seluruh tabel stamp; kini 28,8 ribu/hari).
    const all = await env.DB.prepare('SELECT table_name, stamp, dels FROM ari_sync_state')
      .all<{ table_name: string; stamp: string; dels: number }>();
    const map: Record<string, string> = {};
    for (const r of all.results ?? []) {
      if (r.table_name === '_map') continue;
      map[r.table_name] = `${r.stamp}:${r.dels ?? 0}`;
    }
    await env.DB.prepare(
      "INSERT INTO ari_sync_state (table_name, stamp, dels) VALUES ('_map', ?, 0) " +
      'ON CONFLICT(table_name) DO UPDATE SET stamp=excluded.stamp'
    ).bind(now, JSON.stringify(map)).run();
  } catch { /* stamp gagal = tarik berikutnya tetap jalan, aman */ }
};

export const handleVersion = async (env: Env): Promise<ApiResult> => {
  // 1 baris dibaca per poll — peta di-'_map' dirangkum ulang server saat tiap tulis.
  const row = await env.DB.prepare(
    "SELECT stamp FROM ari_sync_state WHERE table_name = '_map'"
  ).first<{ stamp: string }>();
  if (row?.stamp) {
    try { return ok(JSON.parse(row.stamp) as Record<string, string>); } catch { /* rusak: jatuh ke baca penuh */ }
  }
  const rows = await env.DB.prepare('SELECT table_name, stamp, dels FROM ari_sync_state')
    .all<{ table_name: string; stamp: string; dels: number }>();
  const map: Record<string, string> = {};
  for (const r of rows.results ?? []) {
    if (r.table_name === '_map') continue;
    map[String(r.table_name)] = `${r.stamp}:${r.dels ?? 0}`;
  }
  return ok(map);
};

// ===================== /api/upsert =====================

/** Cermin trigger ari_tolak_penjualan_ganda (supabase/realtime-lengkap.sql).
 *  Versi terindeks (audit 8 Nov): hash 7 field disimpan di kolom dup_hash
 *  (backfill scripts/backfill-dup-hash.mjs + unique index) — pengecekan jadi
 *  lookup IN ber-index, bukan pindai seluruh tabel. */
const SALES_DUP_FIELDS = ['order_number', 'description', 'variant', 'qty', 'price', 'date', 'marketplace_ref'];

const salesDupHash = (v: Record<string, unknown>): string | null => {
  const joined = SALES_DUP_FIELDS.map(f => String(v?.[f] ?? '')).join('|');
  // Baris tanpa field pembanding sama sekali tidak dianggap kandidat dobel.
  return joined === '||||||' ? null : joined;
};

interface UpsertBody {
  table?: unknown;
  rows?: unknown;
  row?: unknown;
  onConflict?: unknown;
  ignoreDuplicates?: unknown;
}

const dupSalesError = async (env: Env, rows: Record<string, unknown>[]): Promise<string | null> => {
  if (rows.length === 0) return null;
  const incoming: Array<{ hash: string; id: string }> = [];
  for (const r of rows) {
    let v: Record<string, unknown> | null = null;
    try {
      v = typeof r.value === 'string' ? JSON.parse(String(r.value)) : (r.value ?? null) as Record<string, unknown>;
    } catch { /* value bukan JSON: lewati pemeriksaan */ }
    if (!v) continue;
    const hash = salesDupHash(v);
    if (hash) incoming.push({ hash, id: String(r.id) });
  }
  if (incoming.length === 0) return null;

  // Dobel DI DALAM satu request: dua id berbeda dengan hash sama.
  const byHash = new Map<string, Set<string>>();
  for (const g of incoming) {
    if (!byHash.has(g.hash)) byHash.set(g.hash, new Set());
    byHash.get(g.hash)!.add(g.id);
  }
  for (const ids of byHash.values()) {
    if (ids.size > 1) {
      return 'Penjualan ganda ditolak oleh server: data yang persis sama dikirim dengan id berbeda.';
    }
  }

  // Dobel terhadap database: lookup ber-index, bukan pindai tabel.
  for (let i = 0; i < incoming.length; i += IN_CHUNK) {
    const group = incoming.slice(i, i + IN_CHUNK);
    const placeholders = group.map(() => '?').join(',');
    const existing = await env.DB.prepare(
      `SELECT id, dup_hash FROM ari_marketplace_item_sales WHERE dup_hash IN (${placeholders})`
    ).bind(...group.map(g => g.hash)).all<{ id: string; dup_hash: string }>();
    for (const row of existing.results ?? []) {
      const sameRecord = group.some(g => g.hash === row.dup_hash && g.id === String(row.id));
      if (!sameRecord) {
        return 'Penjualan ganda ditolak oleh server: data yang persis sama sudah pernah dibuat dengan id berbeda.';
      }
    }
  }
  return null;
};

export const handleUpsert = async (env: Env, body: UpsertBody): Promise<ApiResult> => {
  const table = String(body.table ?? '');
  if (!READABLE_TABLES.includes(table)) return fail(`Tabel ${table} tidak dapat ditulis.`);

  const rawRows = Array.isArray(body.rows) ? body.rows : [body.row ?? body.rows];
  const rows: Record<string, unknown>[] = [];
  for (const r of rawRows) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return fail('Baris tidak valid.');
    rows.push(r as Record<string, unknown>);
  }
  if (rows.length === 0) return ok(null);
  if (rows.length > 5000) return fail('Terlalu banyak baris dalam satu upsert.');

  const conflictCol = table === 'ari_store' ? 'key' : 'id';
  const onConflict = body.onConflict === undefined || body.onConflict === null
    ? conflictCol
    : String(body.onConflict);
  if (onConflict !== conflictCol) return fail('Kolom konflik tidak didukung.');

  const allowedCols = table === 'ari_store'
    ? STORE_UPSERT_COLS
    : (table === 'ari_marketplace_item_sales' ? [...ROW_UPSERT_COLS, 'dup_hash'] : ROW_UPSERT_COLS);
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!allowedCols.includes(k)) return fail(`Kolom ${k} tidak diperkenankan di ${table}.`);
    }
    if (!(conflictCol in r)) return fail(`Baris harus punya kolom ${conflictCol}.`);
  }

  if (table === 'ari_marketplace_item_sales') {
    const dupErr = await dupSalesError(env, rows);
    if (dupErr) return fail(dupErr);
  }

  const ignore = body.ignoreDuplicates === true;

  // ===== Konflik editan (audit perangkat, tugas 4): baris yang lebih LAMA
  // tidak boleh menimpa yang lebih baru di server. Baca updated_at baris yang
  // ada (lookup terindeks per ≤90 id), tolak yang lebih tua, laporkan daftarnya
  // supaya klien menandainya untuk admin — tidak ada editan hilang diam-diam.
  let conflicts: Array<{ id: string; server_updated_at: string }> = [];
  if (table !== 'ari_store' && !ignore) {
    const byId = new Map(rows.map(r => [String(r[conflictCol]), r]));
    for (let i = 0; i < rows.length; i += IN_CHUNK) {
      const chunkIds = rows.slice(i, i + IN_CHUNK).map(r => String(r[conflictCol]));
      const existingRows = await env.DB.prepare(
        `SELECT id, updated_at FROM ${table} WHERE id IN (${chunkIds.map(() => '?').join(',')})`
      ).bind(...chunkIds).all<{ id: string; updated_at: string }>();
      for (const ex of existingRows.results ?? []) {
        const incoming = byId.get(String(ex.id));
        if (!incoming) continue;
        const incAt = String(incoming.updated_at ?? '');
        if (incAt && ex.updated_at && incAt < ex.updated_at) {
          conflicts.push({ id: ex.id, server_updated_at: ex.updated_at });
        }
      }
    }
    if (conflicts.length > 0) {
      const conflictIds = new Set(conflicts.map(c => c.id));
      for (let idx = rows.length - 1; idx >= 0; idx--) {
        if (conflictIds.has(String(rows[idx][conflictCol]))) rows.splice(idx, 1);
      }
    }
  }
  if (rows.length === 0) return ok({ changes: 0, conflicts });

  // Kolom dup_hash (anti penjualan ganda) dihitung server agar backfill & client
  // lama otomatis konsisten.
  if (table === 'ari_marketplace_item_sales') {
    for (const r of rows) {
      let v: Record<string, unknown> | null = null;
      try {
        v = typeof r.value === 'string' ? JSON.parse(String(r.value)) : (r.value ?? null) as Record<string, unknown>;
      } catch { v = null; }
      const hash = v ? salesDupHash(v) : null;
      if (hash) r.dup_hash = hash; else delete r.dup_hash;
    }
  }
  const toSqlText = (v: unknown): unknown => {
    if (v === undefined) return null;
    if (v === null) return null;
    // Kolom value bisa dikirim sebagai objek/JSON — simpan sebagai teks JSON.
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  };

  let changes = 0;
  // Baris yang ditolak server saat eksekusi per-baris (dilaporkan ke klien supaya
  // hanya baris itu yang diulang/dicatat — bukan seluruh chunk).
  const failed: Array<{ id: string; error: string }> = [];
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const stmts: D1PreparedStatement[] = [];
    for (const r of chunk) {
      const cols = Object.keys(r);
      const extra = cols.filter(c => c !== conflictCol);
      // Tanpa kolom lain selain kolom konflik, atau ignoreDuplicates → DO NOTHING
      // (baris pertama yang masuk menang, scan ganda antar perangkat ditolak).
      const clause = ignore || extra.length === 0
        ? 'DO NOTHING'
        : `DO UPDATE SET ${extra.map(c => `"${c}" = excluded."${c}"`).join(', ')}`;
      stmts.push(env.DB.prepare(
        `INSERT INTO ${table} (${cols.map(c => `"${c}"`).join(', ')})` +
        ` VALUES (${cols.map(() => '?').join(',')}) ON CONFLICT("${conflictCol}") ${clause}`
      ).bind(...cols.map(c => toSqlText(r[c]))));
    }
    try {
      const results = await env.DB.batch(stmts);
      for (const res of results) changes += Number(res.meta?.changes ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE') && msg.includes('dup_hash')) {
        return fail('Penjualan ganda ditolak oleh server: data yang persis sama sudah pernah dibuat dengan id berbeda.');
      }
      // Satu baris bermasalah TIDAK BOLEH menggagalkan chunk-nya (audit 9 Nov:
      // sisa 89 baris ikut masuk antrean berulang-ulang karena satu baris ditolak).
      // Ulangi per baris: yang berhasil dihitung, yang gagal dilaporkan per id.
      for (let j = 0; j < chunk.length; j++) {
        const r = chunk[j];
        const cols = Object.keys(r);
        const extra = cols.filter(c => c !== conflictCol);
        const clause = ignore || extra.length === 0
          ? 'DO NOTHING'
          : `DO UPDATE SET ${extra.map(c => `"${c}" = excluded."${c}"`).join(', ')}`;
        try {
          const res = await env.DB.prepare(
            `INSERT INTO ${table} (${cols.map(c => `"${c}"`).join(', ')})` +
            ` VALUES (${cols.map(() => '?').join(',')}) ON CONFLICT("${conflictCol}") ${clause}`
          ).bind(...cols.map(c => toSqlText(r[c]))).run();
          changes += Number(res.meta?.changes ?? 0);
        } catch (e2) {
          failed.push({ id: String(r[conflictCol] ?? ''), error: e2 instanceof Error ? e2.message : String(e2) });
        }
      }
      if (failed.length === chunk.length) return fail(msg);
    }
  }
  if (changes > 0) await bumpStamp(env, table);
  return ok({ changes, conflicts, failed });
};
