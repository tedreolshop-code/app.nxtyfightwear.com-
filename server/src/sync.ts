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
const MAX_FILTER_VALUES = 900; // batas bind parameter SQLite ≈ 999

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
        const values = Array.isArray(f.value)
          ? f.value.filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
          : [];
        if (values.length === 0 || values.length > MAX_FILTER_VALUES) return fail('Daftar IN tidak valid.');
        filters.push({ col: f.col, json: f.json ? String(f.json) : undefined, op, values });
      } else {
        filters.push({ col: f.col, json: f.json ? String(f.json) : undefined, op, value: f.value });
      }
    }
  }

  const where: string[] = [];
  const params: unknown[] = [];
  for (const f of filters) {
    const expr = colExpr(f);
    if (f.op === 'in') {
      const placeholders = (f.values as unknown[]).map(() => '?').join(',');
      where.push(`${expr} IN (${placeholders})`);
      params.push(...(f.values as unknown[]));
    } else {
      const sym = f.op === 'eq' ? '=' : f.op === 'gt' ? '>' : f.op === 'gte' ? '>=' : '<=';
      where.push(`${expr} ${sym} ?`);
      params.push(f.value);
    }
  }

  const limit = Number.isFinite(Number(body.limit))
    ? Math.min(Math.max(Number(body.limit), 1), 10_000)
    : null;
  const offset = Number.isFinite(Number(body.offset)) ? Math.max(Number(body.offset), 0) : 0;

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

  const rows = await env.DB.prepare(parts.join(' ')).bind(...params).all<Record<string, unknown>>();
  // Paritas JSONB PostgREST: kolom value dikirim kembali sebagai OBJEK (bukan teks
  // JSON) — klien (cloudSync) mengandalkan bentuk objek untuk merge store/tombstone.
  const parsed = (rows.results ?? []).map(row => {
    if (typeof row.value === 'string' && row.value.length > 0) {
      try { return { ...row, value: JSON.parse(row.value) }; } catch { return row; }
    }
    return row;
  });
  if (body.single) return ok(parsed.length > 0 ? parsed[0] : null);
  return ok(parsed);
};

// ===================== /api/version =====================

/** Stamp per tabel — klien bandingkan supaya tarik ringan bisa dilewati total. */
export const handleVersion = async (env: Env): Promise<ApiResult> => {
  const rows = await env.DB.prepare('SELECT table_name, stamp FROM ari_sync_state').all<{ table_name: string; stamp: string }>();
  const map: Record<string, string> = {};
  for (const r of rows.results ?? []) map[String(r.table_name)] = String(r.stamp);
  return ok(map);
};

/** Tandai tabel berubah (dipanggil setelah upsert/delete/clear sukses). */
export const bumpStamp = async (env: Env, table: string): Promise<void> => {
  try {
    await env.DB.prepare(
      'INSERT INTO ari_sync_state (table_name, stamp) VALUES (?, ?) ON CONFLICT(table_name) DO UPDATE SET stamp=excluded.stamp'
    ).bind(table, new Date().toISOString()).run();
  } catch { /* stamp gagal = tarik berikutnya tetap jalan, aman */ }
};

// ===================== /api/upsert =====================

/** Cermin trigger ari_tolak_penjualan_ganda (supabase/realtime-lengkap.sql). */
const SALES_DUP_FIELDS = ['order_number', 'description', 'variant', 'qty', 'price', 'date', 'marketplace_ref'];

interface UpsertBody {
  table?: unknown;
  rows?: unknown;
  row?: unknown;
  onConflict?: unknown;
  ignoreDuplicates?: unknown;
}

const dupSalesError = async (env: Env, rows: Record<string, unknown>[]): Promise<string | null> => {
  if (rows.length === 0) return null;
  const selectExpr = SALES_DUP_FIELDS.map(f => `json_extract(value, '$.${f}') AS ${f}`).join(', ');
  const existing = await env.DB.prepare(
    `SELECT id, ${selectExpr} FROM ari_marketplace_item_sales`
  ).all<Record<string, unknown>>();
  // 7 field identik + id BERBEDA = penjualan dobel → tolak (semantik trigger SQL).
  const keyOf = (v: Record<string, unknown>): string =>
    SALES_DUP_FIELDS.map(f => String(v[f] ?? '')).join('\u0001');

  const keys = new Map<string, Set<string>>();
  for (const row of existing.results ?? []) {
    const k = keyOf(row);
    if (!keys.has(k)) keys.set(k, new Set());
    keys.get(k)!.add(String(row.id));
  }
  for (const r of rows) {
    let v: Record<string, unknown> | null = null;
    try {
      v = typeof r.value === 'string' ? JSON.parse(String(r.value)) : (r.value ?? null) as Record<string, unknown>;
    } catch { /* value bukan JSON: lewati pemeriksaan */ }
    if (!v) continue;
    const ids = keys.get(keyOf(v));
    if (ids && !ids.has(String(r.id))) {
      return 'Penjualan ganda ditolak oleh server: data yang persis sama sudah pernah dibuat dengan id berbeda.';
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

  const allowedCols = table === 'ari_store' ? STORE_UPSERT_COLS : ROW_UPSERT_COLS;
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
  const toSqlText = (v: unknown): unknown => {
    if (v === undefined) return null;
    if (v === null) return null;
    // Kolom value bisa dikirim sebagai objek/JSON — simpan sebagai teks JSON.
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  };

  let changes = 0;
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
      return fail(e instanceof Error ? e.message : String(e));
    }
  }
  await bumpStamp(env, table);
  return ok(changes);
};
