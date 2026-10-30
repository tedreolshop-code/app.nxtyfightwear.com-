/**
 * Tipe minimal runtime Cloudflare (_workers types_) — cukup untuk Worker ini
 * tanpa menambah dependency. Deklarasi mengikuti @cloudflare/workers-types
 * untuk bagian yang dipakai: D1 & R2.
 */

export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: { changes?: number; duration?: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result<unknown>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface R2PutOptions {
  httpMetadata?: { contentType?: string };
}

export interface R2ObjectBody {
  key: string;
  httpMetadata?: { contentType?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
  body: ReadableStream;
}

export interface R2Bucket {
  put(key: string, value: ArrayBuffer | Uint8Array | string, options?: R2PutOptions): Promise<{ key: string } | null>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
}

export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  /** Daftar origin app yang dipercaya, pisah koma. Tanpa Origin (curl/script) diizinkan. */
  ALLOWED_ORIGINS: string;
  /** Domain publik bucket R2 (mis. https://cdn.nxtyfightwear.com). Kosong = serve via Worker. */
  R2_PUBLIC_URL: string;
}

/** Pola jawaban semua endpoint: { data, error } — meniru bentuk supabase-js. */
export type ApiResult = { data: unknown; error: string | null; [k: string]: unknown };

export const ok = (data: unknown): ApiResult => ({ data, error: null });
export const fail = (message: string): ApiResult => ({ data: null, error: message });
