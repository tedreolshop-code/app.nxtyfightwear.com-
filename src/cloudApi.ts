/**
 * Adapter Cloudflare — meniru SUBSET API @supabase/supabase-js yang dipakai
 * src/cloudSync.ts & src/packingPhoto.ts, tetapi mengirimkan setiap kueri ke
 * Worker API (server/src/worker.ts) yang membungkus D1/R2.
 *
 * Cakupan yang ditiru (semua yang sesungguhnya dipakai cloudSync.ts):
 *   client.from(t).select('kolom')...eq/gt/gte/in/range/filter  → {data: T[], error}
 *   client.from(t).select('kolom')....maybeSingle()             → {data: T|null, error}
 *   client.from(t).upsert(baris, {onConflict, ignoreDuplicates})→ {error}
 *   client.rpc(name, args)                                      → {data, error}
 *
 * Perbedaan penting vs Supabase:
 *   - Tidak ada realtime channel. Peremajaan lintas-perangkat kini lewat
 *     sinkron wake-up berkala (interval 30s di cloudSync.ts).
 *   - Filter dengan path JSON dikirim eksplisit: 'value->>timestamp'.
 *   - Ditambah photoApi untuk upload/serve/hapus foto (R2).
 *
 * Jika VITE_API_BASE_URL tidak diisi, adapter dianggap "cloud mati" — aplikasi
 * berjalan lokal persis seperti semula.
 */

const API_BASE = import.meta.env?.VITE_API_BASE_URL as string | undefined;
export const isCloudApiEnabled = Boolean(API_BASE);

export type CloudError = { message: string } | null;

interface Filter {
  col: string;
  json?: string;
  op: 'eq' | 'gt' | 'gte' | 'lte' | 'in';
  value?: unknown;
  values?: unknown[];
}

interface QueryBody {
  table: string;
  columns: string[];
  filters: Filter[];
  limit?: number;
  offset?: number;
  single: boolean;
}

/** Parser filter 'value->>timestamp' — dipakai via .gte/.filter (cloudSync). */
const parseCol = (col: string): { col: string; json?: string } => {
  const m = /^(.+?)->>(.+)$/.exec(col);
  if (!m) return { col };
  return { col: m[1], json: m[2] };
};

const errText = async (res: Response): Promise<string> => {
  try {
    const j = await res.json() as { error?: unknown };
    if (typeof j.error === 'string' && j.error) return j.error;
  } catch { /* body bukan JSON */ }
  return `HTTP ${res.status} ${res.statusText}`;
};

const runQuery = async (body: QueryBody): Promise<{ data: unknown; error: CloudError }> => {
  if (!API_BASE || !isCloudApiEnabled) {
    return { data: null, error: { message: 'Cloud tidak aktif (VITE_API_BASE_URL kosong).' } };
  }
  try {
    const res = await fetch(`${API_BASE}/api/q`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { data: null, error: { message: await errText(res) } };
    const json = await res.json() as { data?: unknown; error?: unknown };
    if (typeof json.error === 'string' && json.error) {
      return { data: null, error: { message: json.error } };
    }
    return { data: json.data ?? null, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
};

// ===================== Builder klik-rantai ala PostgREST =====================

type Shared = { filters: Filter[]; limit?: number; offset?: number };

class QueryBuilder<T = Record<string, any>> implements PromiseLike<ListResult<T>> {
  constructor(
    private table: string,
    private columns: string[],
    private shared: Shared,
  ) {}

  private add(col: string, op: Filter['op'], value: unknown, values?: unknown[]): this {
    const { col: c, json } = parseCol(col);
    this.shared.filters.push(values !== undefined ? { col: c, json, op, values } : { col: c, json, op, value });
    return this;
  }

  eq(col: string, value: unknown): this { return this.add(col, 'eq', value); }
  gt(col: string, value: unknown): this { return this.add(col, 'gt', value); }
  gte(col: string, value: unknown): this { return this.add(col, 'gte', value); }
  /** filter('value->>timestamp', 'gte', x) — dipakai ensureHistory. */
  filter(col: string, op: string, value: unknown): this {
    if (!['eq', 'gt', 'gte', 'lte'].includes(op)) {
      throw new Error(`filter(${op}) tidak didukung adapter cloudApi.`);
    }
    return this.add(col, op as Filter['op'], value);
  }
  /** in('id', ids) — dikirim sekali; Worker menolak jika melebihi batas bind. */
  in(col: string, values: unknown[]): this { return this.add(col, 'in', undefined, values); }
  /** range(from, to) — inklusif, sama seperti PostgREST. */
  range(from: number, to: number): this {
    this.shared.offset = from;
    this.shared.limit = to - from + 1;
    return this;
  }
  maybeSingle<T2 = T>(): SingleQueryBuilder<T2> {
    return new SingleQueryBuilder<T2>(this.table, this.columns, this.shared);
  }

  private body(): QueryBody {
    return {
      table: this.table,
      columns: this.columns,
      filters: this.shared.filters,
      limit: this.shared.limit,
      offset: this.shared.offset,
      single: false,
    };
  }

  async execute(): Promise<ListResult<T>> {
    const { data, error } = await runQuery(this.body());
    return { data: (data ?? []) as T[], error };
  }

  then<TResult1 = ListResult<T>, TResult2 = never>(
    onfulfilled?: ((value: ListResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export type ListResult<T> = { data: T[] | null; error: CloudError };
export type SingleResult<T> = { data: T | null; error: CloudError };

class SingleQueryBuilder<T = Record<string, any>> implements PromiseLike<SingleResult<T>> {
  constructor(
    private table: string,
    private columns: string[],
    private shared: Shared,
  ) {}

  async execute(): Promise<SingleResult<T>> {
    const { data, error } = await runQuery({
      table: this.table,
      columns: this.columns,
      filters: this.shared.filters,
      limit: this.shared.limit,
      offset: this.shared.offset,
      single: true,
    });
    return { data: (data ?? null) as T | null, error };
  }

  then<TResult1 = SingleResult<T>, TResult2 = never>(
    onfulfilled?: ((value: SingleResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ===================== upsert & rpc =====================

export interface UpsertResult { data: unknown; error: CloudError }

export interface CloudClient {
  from(table: string): {
    select(select: string): QueryBuilder<Record<string, any>>;
    upsert(payload: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }): Promise<UpsertResult>;
  };
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: CloudError }>;
}

const runUpsert = async (
  table: string, payloads: Record<string, unknown>[] | Record<string, unknown>,
  opts: { onConflict?: string; ignoreDuplicates?: boolean }
): Promise<UpsertResult> => {
  if (!API_BASE || !isCloudApiEnabled) {
    return { data: null, error: { message: 'Cloud tidak aktif (VITE_API_BASE_URL kosong).' } };
  }
  try {
    const res = await fetch(`${API_BASE}/api/upsert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        table,
        ...(Array.isArray(payloads) ? { rows: payloads } : { row: payloads }),
        onConflict: opts.onConflict,
        ignoreDuplicates: opts.ignoreDuplicates,
      }),
    });
    if (!res.ok) return { data: null, error: { message: await errText(res) } };
    const json = await res.json() as { data?: unknown; error?: unknown };
    if (typeof json.error === 'string' && json.error) {
      return { data: json.data ?? null, error: { message: json.error } };
    }
    return { data: json.data ?? null, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
};

/** RPC → endpoint Worker dengan nama yang setara (ari_login/logout/delete_rows/clear_table). */
const RPC_ROUTES: Record<string, string> = {
  ari_login: '/api/login',
  ari_logout: '/api/logout',
  ari_delete_rows: '/api/delete',
  ari_clear_table: '/api/clear',
};

export const createClient = (_url?: string, _key?: string): CloudClient => ({
  from(table: string) {
    return {
      select(select: string): QueryBuilder<Record<string, any>> {
        return new QueryBuilder<Record<string, any>>(
          table,
          select.split(',').map(s => s.trim()).filter(Boolean),
          { filters: [] },
        );
      },
      upsert(payload, opts = {}) {
        return runUpsert(table, payload, opts);
      },
    };
  },
  async rpc(name, args) {
    const route = RPC_ROUTES[name];
    if (!route || !API_BASE || !isCloudApiEnabled) {
      return { data: null, error: { message: `RPC tidak dikenal atau cloud tidak aktif: ${name}` } };
    }
    try {
      const res = await fetch(`${API_BASE}${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!res.ok) return { data: null, error: { message: await errText(res) } };
      const json = await res.json() as { data?: unknown; error?: unknown };
      if (typeof json.error === 'string' && json.error) {
        return { data: null, error: { message: json.error } };
      }
      return { data: json.data ?? null, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
  },
});

// ===================== Versi per-tabel (hemat kuota baca) =====================

/**
 * Peta stamp per tabel dari /api/version (1 request kecil). Klien (cloudSync)
 * membandingkan: kalau identik dengan yang terakhir diketahui → tarik ringan
 * dilewati total — menghemat ribuan baris baca D1 per polling.
 */
export const getCloudVersion = async (): Promise<Record<string, string> | null> => {
  if (!API_BASE || !isCloudApiEnabled) return null;
  try {
    const res = await fetch(`${API_BASE}/api/version`);
    if (!res.ok) return null;
    const json = await res.json() as { data?: unknown; error?: unknown };
    if (typeof json.error === 'string' && json.error) return null;
    return (json.data ?? null) as Record<string, string> | null;
  } catch {
    return null;
  }
};

// ===================== Registry perangkat =====================

/** Ping perangkat: admin melihat perangkat aktif & pending-nya (tugas 7). */
export const pingDeviceApi = async (deviceId: string, pending: number, userAgent: string): Promise<void> => {
  if (!API_BASE || !isCloudApiEnabled) return;
  try {
    await fetch(`${API_BASE}/api/device`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, pending, user_agent: userAgent }),
    });
  } catch { /* ping gagal: dicoba pada detak berikutnya */ }
};

// ===================== Foto (R2 via Worker) =====================

export const photoApi = {
  /** Upload berkas dengan key yang sudah disiapkan pemanggil (flat, tanpa '/'). */
  upload: async (key: string, file: File): Promise<{ url: string | null; error: string | null }> => {
    if (!API_BASE || !isCloudApiEnabled) return { url: null, error: 'Cloud tidak aktif.' };
    try {
      const form = new FormData();
      form.append('key', key);
      form.append('file', file);
      const res = await fetch(`${API_BASE}/api/photo`, { method: 'POST', body: form });
      if (!res.ok) return { url: null, error: await errText(res) };
      const json = await res.json() as { data?: { url?: string }; error?: unknown };
      if (typeof json.error === 'string' && json.error) return { url: null, error: json.error };
      return { url: (json.data?.url ?? null) as string | null, error: null };
    } catch (e) {
      return { url: null, error: e instanceof Error ? e.message : String(e) };
    }
  },
  /** Hapus berkas berdasarkan key atau URL publiknya. */
  remove: async (keyOrUrl: string): Promise<string | null> => {
    if (!API_BASE || !isCloudApiEnabled) return 'Cloud tidak aktif.';
    try {
      const res = await fetch(`${API_BASE}/api/photo`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: keyOrUrl, url: keyOrUrl }),
      });
      if (!res.ok) return await errText(res);
      const json = await res.json() as { error?: unknown };
      return typeof json.error === 'string' && json.error ? json.error : null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  },
};
