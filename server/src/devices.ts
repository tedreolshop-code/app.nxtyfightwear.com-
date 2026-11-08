// Registry perangkat: klien ping tiap ±5 menit; admin melihat daftar perangkat,
// terakhir aktif, dan jumlah perubahan yang belum tersimpan di masing-masing.

import { Env, ApiResult, ok, fail } from './cf';

const DEVICE_ID_RE = /^[A-Za-z0-9-]{6,64}$/;

export const handleDevicePing = async (env: Env, body: Record<string, unknown>): Promise<ApiResult> => {
  const deviceId = String(body.device_id ?? '');
  if (!DEVICE_ID_RE.test(deviceId)) return fail('ID perangkat tidak valid.');
  const pending = Math.max(0, Math.min(9999, Number(body.pending ?? 0) || 0));
  const userAgent = String(body.user_agent ?? '').slice(0, 200);
  await env.DB.prepare(
    'INSERT INTO ari_devices (device_id, last_sync, pending, user_agent) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(device_id) DO UPDATE SET last_sync=excluded.last_sync, pending=excluded.pending, user_agent=excluded.user_agent'
  ).bind(deviceId, new Date().toISOString(), pending, userAgent).run();
  return ok({ device_id: deviceId });
};

export const handleDevicesList = async (env: Env): Promise<ApiResult> => {
  const rows = await env.DB.prepare(
    'SELECT device_id, last_sync, pending, user_agent FROM ari_devices ORDER BY last_sync DESC LIMIT 100'
  ).all<{ device_id: string; last_sync: string; pending: number; user_agent: string }>();
  return ok(rows.results ?? []);
};
