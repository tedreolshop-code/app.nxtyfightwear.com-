/**
 * Worker API ARI SPORTINDO (D1 + R2) — pengganti PostgREST + Storage Supabase.
 *
 * Bindings (wrangler.toml): DB (D1), PHOTOS (R2). Vars: ALLOWED_ORIGINS,
 * R2_PUBLIC_URL.
 *
 * Endpoint:
 *   POST /api/q         kueri data (subset postgrest: eq/gt/gte/lte/in/range/maybeSingle)
 *   POST /api/upsert    insert/update per baris (onConflict id/key, ignoreDuplicates)
 *   POST /api/login     verifikasi PIN di server → token sesi (ari_login)
 *   POST /api/logout    hapus sesi (ari_logout)
 *   POST /api/delete    hapus ids, token + role + guard massal (ari_delete_rows)
 *   POST /api/clear     kosongkan tabel, token + role (ari_clear_table)
 *   POST /api/photo     upload foto multipart → R2
 *   GET  /api/photo/:k  serve foto dari R2
 *   DELETE /api/photo   hapus foto (key berasal dari body/url)
 *   GET  /health        cek hidup
 */

import { Env, ApiResult } from './cf';
import { handleLogin, handleLogout, handleDeleteRows, handleClearTable } from './auth';
import { handleQuery, handleUpsert } from './sync';
import { handlePhotoUpload, handlePhotoDelete, servePhoto } from './photos';

const json = (result: ApiResult, status = 200, cors: HeadersInit = {}): Response => (
  new Response(JSON.stringify(result), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors },
  })
);

const corsHeaders = (env: Env, origin: string | null): Record<string, string> => {
  const allowed = env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
  };
};

interface JsonBody {
  [k: string]: unknown;
}

const readJsonBody = async (req: Request): Promise<JsonBody> => {
  try {
    const parsed = await req.json() as unknown;
    return parsed && typeof parsed === 'object' ? parsed as JsonBody : {};
  } catch {
    return {};
  }
};

export default {
  async fetch(req: Request, env: Env, ctx?: { waitUntil?(p: Promise<unknown>): void }): Promise<Response> {
    void ctx;
    const url = new URL(req.url);
    const cors = corsHeaders(env, req.headers.get('Origin'));
    const answer = (r: ApiResult, status = 200): Response => json(r, status, cors);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    const origin = req.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
    // Browser selalu mengirim Origin — kalau tidak ada berarti bukan browser
    // (curl / skrip migrasi), diizinkan. Browser dengan origin asing ditolak.
    if (origin && origin !== 'null' && !allowed.includes(origin)) {
      return answer({ data: null, error: 'Origin tidak diizinkan.' }, 403);
    }

    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        return answer({ data: { ok: true, time: new Date().toISOString() }, error: null });
      }

      if (req.method === 'POST') {
        switch (url.pathname) {
          case '/api/q':
            return answer(await handleQuery(env, await readJsonBody(req)));
          case '/api/upsert':
            return answer(await handleUpsert(env, await readJsonBody(req)));
          case '/api/login':
            return answer(await handleLogin(env, await readJsonBody(req)));
          case '/api/logout':
            return answer(await handleLogout(env, await readJsonBody(req)));
          case '/api/delete':
            return answer(await handleDeleteRows(env, await readJsonBody(req)));
          case '/api/clear':
            return answer(await handleClearTable(env, await readJsonBody(req)));
          case '/api/photo':
            return answer(await handlePhotoUpload(env, req));
          default:
            return answer({ data: null, error: 'Endpoint tidak dikenal.' }, 404);
        }
      }

      const photoKey = /^\/api\/photo\/(.+)$/.exec(url.pathname);
      if (req.method === 'GET' && photoKey) {
        const key = decodeURIComponent(photoKey[1]);
        return await servePhoto(env, key);
      }
      if (req.method === 'DELETE' && url.pathname === '/api/photo') {
        return answer(await handlePhotoDelete(env, await readJsonBody(req)));
      }

      return answer({ data: null, error: 'Endpoint tidak dikenal.' }, 404);
    } catch (e) {
      console.error('[worker] error', req.method, url.pathname, e);
      return answer({ data: null, error: e instanceof Error ? e.message : 'Kesalahan server.' }, 500);
    }
  },
};
