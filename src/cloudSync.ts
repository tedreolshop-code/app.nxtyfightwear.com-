/**
 * Sinkronisasi data ARI SPORTINDO ke Supabase.
 *
 * Cara kerja:
 * - localStorage tetap menjadi sumber baca sinkron untuk seluruh modul (dataStore tidak berubah API-nya).
 * - Saat aplikasi dibuka: semua baris tabel `ari_store` di Supabase ditarik ke localStorage.
 * - Setiap dataStore.set(): data ditulis ke localStorage lalu di-push (debounced) ke Supabase.
 * - Perubahan dari perangkat lain diterima lewat Supabase Realtime dan langsung memperbarui localStorage.
 *
 * Jika VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tidak diisi, aplikasi berjalan offline
 * (hanya localStorage) persis seperti sebelumnya.
 *
 * Setup database: jalankan supabase/setup.sql di SQL Editor project Supabase Anda.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

const TABLE = 'ari_store';
// Absensi disimpan SATU BARIS PER SCAN di tabel terpisah, agar absen bersamaan
// dari banyak HP tidak saling menimpa (insert per baris, bukan replace array utuh).
const ATT_TABLE = 'ari_attendance';
const ATT_KEY = 'attendance';
const ATT_PENDING_KEY = 'nxty_attendance_pending';
export const isCloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Data master/transaksi yang RAWAN HILANG bila disimpan sebagai satu array besar
// (last-writer-wins) kini disimpan SATU BARIS PER RECORD di tabel per-key, dengan
// Supabase sebagai sumber data utama: upsert/hapus per baris, tidak saling menimpa.
// Tambah key baru di sini untuk memindahkannya ke model per-baris.
interface PerRowSync {
  key: string;        // key localStorage (tanpa prefix nxty_) & key di dataStore
  table: string;      // nama tabel Supabase
  ready: boolean;     // true setelah tarikan awal selesai (gerbang anti-timpa seed/migrasi)
  appendOnly?: boolean; // log yang terus bertambah & tak pernah dihapus per-baris (hanya
                        // dikosongkan sekaligus) — lewati delete-not-in agar filter tidak
                        // membengkak seiring data. Hapus semua hanya saat daftar dikosongkan.
}
const PER_ROW: PerRowSync[] = [
  // Master
  { key: 'employees', table: 'ari_employees', ready: !isCloudEnabled },
  { key: 'departments', table: 'ari_departments', ready: !isCloudEnabled },
  { key: 'customers', table: 'ari_customers', ready: !isCloudEnabled },
  { key: 'assets', table: 'ari_assets', ready: !isCloudEnabled },
  // Gudang
  { key: 'products', table: 'ari_products', ready: !isCloudEnabled },
  { key: 'raw_materials', table: 'ari_raw_materials', ready: !isCloudEnabled },
  { key: 'stock_movements', table: 'ari_stock_movements', ready: !isCloudEnabled, appendOnly: true },
  // Penjualan
  { key: 'orders', table: 'ari_orders', ready: !isCloudEnabled },
  { key: 'marketplace_sales', table: 'ari_marketplace_sales', ready: !isCloudEnabled },
  { key: 'marketplace_item_sales', table: 'ari_marketplace_item_sales', ready: !isCloudEnabled },
  { key: 'invoices', table: 'ari_invoices', ready: !isCloudEnabled },
  { key: 'delivery_notes', table: 'ari_delivery_notes', ready: !isCloudEnabled },
  { key: 'returns', table: 'ari_returns', ready: !isCloudEnabled },
  // Produksi
  { key: 'production_jobs', table: 'ari_production_jobs', ready: !isCloudEnabled },
  { key: 'production_handoffs', table: 'ari_production_handoffs', ready: !isCloudEnabled },
  { key: 'rejected_goods', table: 'ari_rejected_goods', ready: !isCloudEnabled },
  { key: 'production_task_logs', table: 'ari_production_task_logs', ready: !isCloudEnabled },
  { key: 'production_logs', table: 'ari_production_logs', ready: !isCloudEnabled, appendOnly: true },
  { key: 'packing_tasks', table: 'ari_packing_tasks', ready: !isCloudEnabled },
  // Pembelian & pengeluaran
  { key: 'purchases', table: 'ari_purchases', ready: !isCloudEnabled },
  { key: 'daily_expenses', table: 'ari_daily_expenses', ready: !isCloudEnabled },
  // Gaji / kasbon
  { key: 'payroll_weekly', table: 'ari_payroll_weekly', ready: !isCloudEnabled },
  { key: 'cash_advances', table: 'ari_cash_advances', ready: !isCloudEnabled },
  { key: 'cash_advance_transactions', table: 'ari_cash_advance_transactions', ready: !isCloudEnabled },
  { key: 'attendance_bonus_payouts', table: 'ari_attendance_bonus_payouts', ready: !isCloudEnabled },
  // Absensi (koreksi/ACC + jejak scan gagal)
  { key: 'attendance_failures', table: 'ari_attendance_failures', ready: !isCloudEnabled, appendOnly: true },
  { key: 'attendance_adjustments', table: 'ari_attendance_adjustments', ready: !isCloudEnabled },
  // Notifikasi
  { key: 'notifications', table: 'ari_notifications', ready: !isCloudEnabled },
];
const perRowByKey = new Map(PER_ROW.map(cfg => [cfg.key, cfg]));

export type CloudStatus = 'offline' | 'connecting' | 'online' | 'error';
let status: CloudStatus = isCloudEnabled ? 'connecting' : 'offline';

export const getCloudStatus = (): CloudStatus => status;

const setStatus = (s: CloudStatus) => {
  status = s;
  window.dispatchEvent(new CustomEvent('nxty_cloud_status', { detail: s }));
};

let client: SupabaseClient | null = null;
if (isCloudEnabled) {
  client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}
export const getSupabaseClient = () => client;

// Penanda agar penulisan yang berasal dari cloud tidak di-push balik ke cloud (loop)
let applyingRemote = false;
export const isApplyingRemote = () => applyingRemote;

// Debounce push per key supaya input beruntun tidak membanjiri jaringan
const pendingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

// ===================== Jalur umum per-baris (Supabase = sumber data utama) =====================

type RowLike = { id: string };

const readLocalRows = (key: string): RowLike[] => {
  try { return JSON.parse(localStorage.getItem(`nxty_${key}`) || '[]'); } catch { return []; }
};

// Cuplikan baris yang TERAKHIR diketahui sama dengan cloud (id -> JSON value).
// Dipakai push per-baris untuk hanya mengirim baris yang benar-benar berubah —
// tanpa ini setiap simpan menyetel updated_at SEMUA baris, dan sinkron bertahap
// (updated_at > watermark) jadi menarik seluruh tabel lagi.
const cloudSnapshot = new Map<string, Map<string, string>>();
const snapshotFrom = (rows: RowLike[]): Map<string, string> =>
  new Map(rows.filter(r => r && r.id).map(r => [r.id, JSON.stringify(r)]));

const writeLocalRows = (key: string, rows: RowLike[]) => {
  applyingRemote = true;
  try {
    localStorage.setItem(`nxty_${key}`, JSON.stringify(rows));
    // Data dari cloud = baseline baru; simpan lokal berikutnya membandingkan ke sini.
    cloudSnapshot.set(key, snapshotFrom(rows));
    window.dispatchEvent(new Event('nxty_storage_change'));
  } finally {
    applyingRemote = false;
  }
};

/**
 * Simpan SELURUH daftar sebuah key ke Supabase secara per-baris:
 * - setiap record di-upsert (onConflict id) — aman dari tabrakan array besar,
 * - record yang tidak lagi ada di daftar dihapus dari database.
 * No-op sampai tarikan awal selesai (cfg.ready) agar seed/migrasi tidak
 * menghapus data asli di database sebelum kita membacanya.
 */
const pushRowsToCloud = (cfg: PerRowSync, list: RowLike[]): void => {
  if (!client || applyingRemote || !cfg.ready) return;
  void (async () => {
    try {
      const clean = list.filter(r => r && r.id);
      if (clean.length === 0) {
        const { error } = await client!.from(cfg.table).delete().neq('id', '');
        if (error) throw error;
        cloudSnapshot.set(cfg.key, new Map());
        if (status !== 'online') setStatus('online');
        return;
      }

      const prev = cloudSnapshot.get(cfg.key);
      // Baris baru / berubah saja yang di-upsert (updated_at ikut ter-refresh).
      const changed = prev
        ? clean.filter(r => prev.get(r.id) !== JSON.stringify(r))
        : clean;
      if (changed.length > 0) {
        const rows = changed.map(r => ({ id: r.id, value: r, updated_at: new Date().toISOString() }));
        const { error: upErr } = await client!.from(cfg.table).upsert(rows, { onConflict: 'id' });
        if (upErr) throw upErr;
      }
      // Baris yang hilang dari daftar → hapus di cloud (kecuali log append-only).
      if (!cfg.appendOnly && prev) {
        const currentIds = new Set(clean.map(r => r.id));
        const removed = [...prev.keys()].filter(id => !currentIds.has(id));
        if (removed.length > 0) {
          const { error: delErr } = await client!.from(cfg.table).delete().in('id', removed);
          if (delErr) throw delErr;
        }
      } else if (!cfg.appendOnly && !prev) {
        // Belum ada baseline (sinkron awal gagal / offline saat start) → jaga
        // konsistensi seperti sebelumnya: hapus baris yang tidak ada di daftar.
        const keep = `(${clean.map(r => `"${r.id}"`).join(',')})`;
        const { error: delErr } = await client!.from(cfg.table).delete().not('id', 'in', keep);
        if (delErr) throw delErr;
      }

      cloudSnapshot.set(cfg.key, snapshotFrom(clean));
      if (status !== 'online') setStatus('online');
    } catch (e) {
      console.error(`[cloudSync] Gagal menyimpan "${cfg.key}" ke Supabase:`, e);
      setStatus('error');
      // Jangan perbarui snapshot: percobaan simpan berikutnya mengirim ulang.
    }
  })();
};

/**
 * Isian awal tabel kosong (upsert TANPA hapus). Dipakai saat migrasi/instalasi
 * baru supaya data lokal atau data model-lama (array di ari_store) terangkat ke
 * tabel per-baris tanpa risiko saling menghapus antar perangkat.
 */
const seedRowsToCloud = async (cfg: PerRowSync, list: RowLike[]): Promise<void> => {
  if (!client) return;
  const clean = list.filter(r => r && r.id);
  if (clean.length === 0) return;
  const rows = clean.map(r => ({ id: r.id, value: r, updated_at: new Date().toISOString() }));
  const { error } = await client.from(cfg.table).upsert(rows, { onConflict: 'id' });
  if (error) throw error;
};

/** Push satu key (tanpa prefix nxty_) ke Supabase. Dipanggil dataStore setiap kali menulis. */
export const pushKeyToCloud = (key: string, data: unknown): void => {
  if (!client || applyingRemote) return;
  // Absensi TIDAK ikut jalur array utuh — punya jalur per-baris sendiri (pushAttendanceToCloud).
  if (key === ATT_KEY) return;
  // Key per-baris (karyawan, produk, bahan baku, mutasi stok) punya jalurnya sendiri.
  const perRow = perRowByKey.get(key);
  if (perRow) { pushRowsToCloud(perRow, data as RowLike[]); return; }
  if (pendingTimers[key]) clearTimeout(pendingTimers[key]);
  pendingTimers[key] = setTimeout(async () => {
    delete pendingTimers[key];
    try {
      const { error } = await client!
        .from(TABLE)
        .upsert({ key, value: data, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      if (status !== 'online') setStatus('online');
    } catch (e) {
      console.error(`[cloudSync] Gagal push "${key}" ke Supabase:`, e);
      setStatus('error');
    }
  }, 600);
};

// ===================== Jalur khusus absensi (per baris) =====================

type AttendanceRecordLike = { id: string; timestamp?: string };

const readLocalAttendance = (): AttendanceRecordLike[] => {
  try { return JSON.parse(localStorage.getItem(`nxty_${ATT_KEY}`) || '[]'); } catch { return []; }
};

const writeLocalAttendance = (rows: AttendanceRecordLike[]) => {
  applyingRemote = true;
  try {
    localStorage.setItem(`nxty_${ATT_KEY}`, JSON.stringify(rows));
    window.dispatchEvent(new Event('nxty_storage_change'));
  } finally {
    applyingRemote = false;
  }
};

const readPendingAttendance = (): AttendanceRecordLike[] => {
  try { return JSON.parse(localStorage.getItem(ATT_PENDING_KEY) || '[]'); } catch { return []; }
};

const writePendingAttendance = (rows: AttendanceRecordLike[]) => {
  try { localStorage.setItem(ATT_PENDING_KEY, JSON.stringify(rows)); } catch { /* penuh/blokir: abaikan */ }
};

const upsertAttendanceRow = async (record: AttendanceRecordLike): Promise<boolean> => {
  if (!client) return false;
  try {
    const { error } = await client
      .from(ATT_TABLE)
      // ignoreDuplicates: id absensi bersifat deterministik (karyawan+tanggal+jenis scan),
      // jadi baris pertama yang masuk yang menang — scan ganda dari perangkat lain ditolak DB.
      .upsert({ id: record.id, value: record }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
    if (status !== 'online') setStatus('online');
    return true;
  } catch (e) {
    console.error('[cloudSync] Gagal push absensi ke Supabase:', e);
    setStatus('error');
    return false;
  }
};

/** Kirim ulang scan absensi yang tertunda (mis. saat sinyal hilang). */
const flushPendingAttendance = async (): Promise<void> => {
  const pending = readPendingAttendance();
  if (pending.length === 0) return;
  const stillPending: AttendanceRecordLike[] = [];
  for (const rec of pending) {
    const ok = await upsertAttendanceRow(rec);
    if (!ok) stillPending.push(rec);
  }
  writePendingAttendance(stillPending);
};

/**
 * Push SATU record absensi ke cloud (insert per baris — bebas tabrakan antar perangkat).
 * Gagal kirim (offline) → masuk antrean dan dikirim ulang otomatis.
 */
export const pushAttendanceToCloud = (record: AttendanceRecordLike): void => {
  if (!client) return;
  void (async () => {
    const ok = await upsertAttendanceRow(record);
    if (!ok) {
      const pending = readPendingAttendance();
      if (!pending.some(r => r.id === record.id)) writePendingAttendance([...pending, record]);
    } else {
      void flushPendingAttendance();
    }
  })();
};

/** Kosongkan seluruh absensi di cloud (dipakai tombol "Hapus Semua Data Contoh"). */
export const clearAttendanceInCloud = (): void => {
  writePendingAttendance([]);
  if (!client) return;
  void client.from(ATT_TABLE).delete().neq('id', '').then(({ error }) => {
    if (error) console.error('[cloudSync] Gagal mengosongkan absensi di cloud:', error);
  });
};

/**
 * Ambil SEMUA baris tabel per-baris. Supabase/PostgREST membatasi 1000 baris per
 * request, jadi tarik bertahap sampai habis — tanpa ini absensi lama/baru bisa
 * "hilang" begitu jumlah baris melewati 1000.
 */
const fetchAllRows = async (table: string, opts?: { sinceCol?: string; since?: string }): Promise<{ id: string; value: unknown }[]> => {
  const PAGE = 1000;
  const all: { id: string; value: unknown }[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = client!.from(table).select('id, value').range(from, from + PAGE - 1);
    if (opts?.sinceCol && opts.since) q = q.gt(opts.sinceCol, opts.since);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...((data || []) as { id: string; value: unknown }[]));
    if (!data || data.length < PAGE) break;
  }
  return all;
};

/**
 * Gabungkan hasil sinkron bertahap ke data lokal, dedup berdasarkan id:
 * - `changed` (baris baru/berubah dari cloud) menang,
 * - baris lokal lain dipertahankan KECUALI (a) sudah tergantikan `changed`, atau
 *   (b) `cloudIds` ada isinya dan baris itu tak ada di sana (= dihapus di cloud).
 * `cloudIds` null / kosong → jangan buang apa-apa (tabel yang pakai data bawaan).
 */
export const mergeRowsById = <T extends { id: string }>(
  changed: T[], localRows: T[], cloudIds: Set<string> | null
): T[] => {
  const changedIds = new Set(changed.map(r => r.id));
  const kept = localRows.filter(r => r && r.id && !changedIds.has(r.id)
    && (!cloudIds || cloudIds.size === 0 || cloudIds.has(r.id)));
  return [...changed, ...kept];
};

/** Semua id sebuah tabel (ringan, ~15 byte/baris) — untuk mendeteksi baris yang dihapus. */
const fetchAllIds = async (table: string): Promise<Set<string>> => {
  const PAGE = 1000;
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client!.from(table).select('id').range(from, from + PAGE - 1);
    if (error) throw error;
    for (const r of (data || []) as { id: string }[]) ids.add(r.id);
    if (!data || data.length < PAGE) break;
  }
  return ids;
};

// Watermark sinkron bertahap: waktu sinkron cloud terakhir yang berhasil.
const SYNC_AT_KEY = 'nxty_cloud_synced_at';
// updated_at diisi jam perangkat penulis (bukan server). Mundurkan watermark
// jauh (2 jam) supaya beda jam antar-tablet tidak membuat perubahan terlewat —
// tetap murah, biasanya cuma menambah beberapa baris.
const CLOCK_SKEW_MS = 2 * 60 * 60 * 1000;
const FULL_RESYNC_AFTER_MS = 7 * 86400 * 1000;
const readSyncSince = (): string | null => {
  try {
    const raw = localStorage.getItem(SYNC_AT_KEY);
    if (!raw) return null;
    const t = Number(raw);
    if (!t || Date.now() - t > FULL_RESYNC_AFTER_MS) return null; // lama tak dibuka → tarik penuh
    return new Date(t - CLOCK_SKEW_MS).toISOString();
  } catch { return null; }
};
const writeSyncNow = () => { try { localStorage.setItem(SYNC_AT_KEY, String(Date.now())); } catch { /* penuh: abaikan */ } };

const sortAttendance = (rows: AttendanceRecordLike[]) =>
  rows.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

/**
 * Tarik ulang absensi TERKINI dari cloud (bawaan: 2 hari terakhir WIB) lalu
 * gabungkan ke localStorage berdasarkan id — tidak menghapus apa pun.
 *
 * Halaman Absensi memakainya sebagai jaring pengaman: realtime kadang putus
 * (tab tidur, sinyal kedip) dan TIDAK mengejar ketinggalan, jadi scan yang
 * masuk selama putus tak pernah muncul sampai halaman di-reload penuh. Ini
 * menutup celah itu tanpa menarik seluruh riwayat.
 *
 * @returns waktu sinkron berhasil, atau null bila cloud mati / gagal.
 */
export const resyncAttendanceFromCloud = async (sinceDays = 2): Promise<Date | null> => {
  if (!client) return null;
  try {
    const since = new Date(Date.now() + 7 * 3600e3 - sinceDays * 86400e3).toISOString().slice(0, 10);
    const { data, error } = await client
      .from(ATT_TABLE)
      .select('id, value')
      .gte('value->>timestamp', since);
    if (error) throw error;
    const fresh = (data || []).map(r => (r as { value: AttendanceRecordLike }).value).filter(r => r && r.id);
    if (fresh.length > 0) {
      const freshIds = new Set(fresh.map(r => r.id));
      const kept = readLocalAttendance().filter(r => r.id && !freshIds.has(r.id));
      writeLocalAttendance(sortAttendance([...fresh, ...kept]));
    }
    void flushPendingAttendance();
    if (status !== 'online') setStatus('online');
    return new Date();
  } catch (e) {
    console.error('[cloudSync] Gagal tarik ulang absensi terkini:', e);
    setStatus('error');
    return null;
  }
};

/** Terapkan satu nilai dari cloud ke localStorage tanpa memicu push balik. */
const applyRemoteValue = (key: string, value: unknown) => {
  applyingRemote = true;
  try {
    localStorage.setItem(`nxty_${key}`, JSON.stringify(value));
    window.dispatchEvent(new Event('nxty_storage_change'));
  } finally {
    applyingRemote = false;
  }
};

/**
 * Sinkronkan data Supabase ke localStorage, lalu dengarkan perubahan realtime.
 * Panggil sekali saat aplikasi start. Aman saat cloud tidak dikonfigurasi (no-op).
 *
 * Tarikan PENUH hanya pada pemakaian pertama / setelah lama tidak dibuka
 * (>7 hari). Selebihnya BERTAHAP: cuma menarik baris yang berubah sejak sinkron
 * terakhir — localStorage jadi cache, hemat egress drastis tanpa kehilangan data
 * (realtime + fetchAllIds menangani penghapusan).
 */
export const initCloudSync = async (): Promise<void> => {
  if (!client) return;
  setStatus('connecting');
  const since = readSyncSince();
  const incremental = since !== null;
  try {
    // ---- ari_store (audit log, recycle bin, brand/work settings) ----
    let storeQ = client.from(TABLE).select('key, value');
    if (incremental) storeQ = storeQ.gt('updated_at', since!);
    const { data, error } = await storeQ;
    if (error) throw error;

    const legacyStore = new Map((data || []).map(row => [row.key as string, row.value]));

    applyingRemote = true;
    try {
      for (const row of data || []) {
        if (row.key === ATT_KEY) continue;
        if (perRowByKey.has(row.key)) continue;
        localStorage.setItem(`nxty_${row.key}`, JSON.stringify(row.value));
      }
    } finally {
      applyingRemote = false;
    }
    if (data && data.length > 0) window.dispatchEvent(new Event('nxty_storage_change'));

    // ---- Absensi ----
    try {
      const attRows = await fetchAllRows(ATT_TABLE, incremental ? { sinceCol: 'created_at', since: since! } : undefined);
      const freshRecs = attRows.map(r => r.value as AttendanceRecordLike).filter(r => r && r.id);
      const local = readLocalAttendance();
      if (incremental) {
        const cloudIds = await fetchAllIds(ATT_TABLE);
        const merged = mergeRowsById(freshRecs as { id: string }[], local as { id: string }[], cloudIds) as AttendanceRecordLike[];
        const localOnly = local.filter(r => r.id && !cloudIds.has(r.id));
        writeLocalAttendance(sortAttendance(merged));
        for (const rec of localOnly) pushAttendanceToCloud(rec);
      } else {
        const cloudIds = new Set(freshRecs.map(r => r.id));
        const localOnly = local.filter(r => r.id && !cloudIds.has(r.id));
        writeLocalAttendance(sortAttendance([...freshRecs, ...localOnly]));
        for (const rec of localOnly) pushAttendanceToCloud(rec);
      }
      void flushPendingAttendance();
    } catch (e) {
      console.error('[cloudSync] Gagal sinkron tabel absensi (sudah jalankan supabase/setup.sql terbaru?):', e);
    }

    // ---- Tabel per-baris ----
    let anyTableFailed = false;
    for (const cfg of PER_ROW) {
      try {
        cfg.ready = true;
        if (incremental) {
          const changed = (await fetchAllRows(cfg.table, { sinceCol: 'updated_at', since: since! }))
            .map(r => r.value as RowLike).filter(r => r && r.id);
          const localRows = readLocalRows(cfg.key);
          // Log append-only tidak pernah hapus baris → lewati cek id (hemat egress).
          const cloudIds = cfg.appendOnly ? null : await fetchAllIds(cfg.table);
          const merged = mergeRowsById(changed, localRows, cloudIds);
          if (merged.length !== localRows.length || changed.length > 0) writeLocalRows(cfg.key, merged);
          else cloudSnapshot.set(cfg.key, snapshotFrom(localRows));
          continue;
        }

        const cloudRows = (await fetchAllRows(cfg.table)).map(r => r.value as RowLike).filter(r => r && r.id);
        if (cloudRows.length > 0) {
          writeLocalRows(cfg.key, cloudRows);
        } else {
          const localRows = readLocalRows(cfg.key);
          const legacy = Array.isArray(legacyStore.get(cfg.key)) ? legacyStore.get(cfg.key) as RowLike[] : [];
          const seed = localRows.length > 0 ? localRows : legacy;
          if (seed.length > 0) {
            if (localRows.length === 0) writeLocalRows(cfg.key, seed);
            await seedRowsToCloud(cfg, seed);
            cloudSnapshot.set(cfg.key, snapshotFrom(seed));
          }
        }
      } catch (e) {
        cfg.ready = true;
        anyTableFailed = true;
        console.error(`[cloudSync] Gagal sinkron tabel "${cfg.table}" (sudah jalankan supabase/setup.sql terbaru?):`, e);
      }
    }

    // Watermark hanya maju bila semua tabel tersinkron — kalau ada yang gagal,
    // pemakaian berikutnya mengulang rentang yang sama, bukan melewatinya.
    if (!anyTableFailed) writeSyncNow();

    // Realtime: perubahan dari perangkat lain langsung masuk
    const channel = client.channel('ari_store_changes');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
      const row = payload.new as { key?: string; value?: unknown } | null;
      if (row && row.key !== undefined && row.key !== ATT_KEY && !perRowByKey.has(row.key)) {
        applyRemoteValue(row.key, row.value);
      }
    });
    // Handler realtime per-baris untuk tiap key (upsert/hapus berdasarkan id).
    for (const cfg of PER_ROW) {
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: cfg.table }, (payload) => {
          const rec = (payload.new as { value?: RowLike } | null)?.value;
          if (!rec?.id) return;
          const local = readLocalRows(cfg.key);
          if (!local.some(r => r.id === rec.id)) writeLocalRows(cfg.key, [...local, rec]);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: cfg.table }, (payload) => {
          const rec = (payload.new as { value?: RowLike } | null)?.value;
          if (!rec?.id) return;
          const local = readLocalRows(cfg.key);
          writeLocalRows(cfg.key, local.some(r => r.id === rec.id)
            ? local.map(r => r.id === rec.id ? rec : r)
            : [...local, rec]);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: cfg.table }, (payload) => {
          const oldId = (payload.old as { id?: string } | null)?.id;
          if (!oldId) return;
          writeLocalRows(cfg.key, readLocalRows(cfg.key).filter(r => r.id !== oldId));
        });
    }
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: ATT_TABLE }, (payload) => {
        const rec = (payload.new as { value?: AttendanceRecordLike } | null)?.value;
        if (!rec?.id) return;
        const local = readLocalAttendance();
        if (!local.some(r => r.id === rec.id)) {
          writeLocalAttendance(sortAttendance([rec, ...local]));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: ATT_TABLE }, (payload) => {
        const rec = (payload.new as { value?: AttendanceRecordLike } | null)?.value;
        if (!rec?.id) return;
        const local = readLocalAttendance();
        writeLocalAttendance(sortAttendance([rec, ...local.filter(r => r.id !== rec.id)]));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: ATT_TABLE }, (payload) => {
        const oldId = (payload.old as { id?: string } | null)?.id;
        if (!oldId) return;
        writeLocalAttendance(readLocalAttendance().filter(r => r.id !== oldId));
      })
      .subscribe();

    setStatus('online');
  } catch (e) {
    console.error('[cloudSync] Gagal inisialisasi Supabase, berjalan offline:', e);
    setStatus('error');
  }
};
