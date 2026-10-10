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
import { getCloudToken, setCloudToken, clearCloudToken } from './cloudAuth';

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

const TABLE = 'ari_store';
// Absensi disimpan SATU BARIS PER SCAN di tabel terpisah, agar absen bersamaan
// dari banyak HP tidak saling menimpa (insert per baris, bukan replace array utuh).
const ATT_TABLE = 'ari_attendance';
const ATT_KEY = 'attendance';
const ATT_PENDING_KEY = 'nxty_attendance_pending';
// Tombol "nisan": id absensi yang sengaja DIBERSIHKAN dari cloud (peleburan
// data dobel via SQL). Tanpa nisan, perangkat yang masih memegang cache lama
// mengirim ulang baris-baris itu saat sinkron (dianggap "hilang dari cloud")
// sehingga data dobel kembali. Nisan disimpan sebagai baris ari_store
// (key 'nxty_attendance_tombstones', array id) — ikut tarik penuh & realtime.
const ATT_TOMBSTONE_KEY = 'nxty_attendance_tombstones';
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

/**
 * Verifikasi PIN di SERVER lalu simpan token sesinya.
 *
 * Sejak policy DELETE dicabut di database (supabase/auth-hapus-bagian2-cutover.sql),
 * menghapus data hanya sah lewat RPC ber-token. Token ini sumbernya ari_login(),
 * yang memeriksa PIN terhadap data karyawan di server — bukan lagi di perangkat.
 *
 * Mengembalikan false (tanpa melempar) bila cloud mati atau PIN ditolak: pemanggil
 * tetap boleh melanjutkan masuk mode offline seperti sebelumnya.
 */
export const loginCloud = async (username: string, pin: string): Promise<boolean> => {
  if (!client) return false;
  try {
    const { data, error } = await client.rpc('ari_login', { p_username: username, p_pin: pin });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { token?: string } | null;
    if (!row?.token) return false;
    setCloudToken(row.token);
    return true;
  } catch (e) {
    console.error('[cloudSync] Gagal masuk ke cloud (verifikasi PIN di server):', e);
    return false;
  }
};

/** Buang sesi cloud: hapus di server (best-effort) lalu lupakan tokennya. */
export const logoutCloud = (): void => {
  const token = getCloudToken();
  clearCloudToken();
  if (!client || !token) return;
  void client.rpc('ari_logout', { p_token: token }).then(({ error }) => {
    if (error) console.error('[cloudSync] Gagal menghapus sesi cloud:', error);
  });
};

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

// Kunci catatan yang terus tumbuh — dilepas dari cache saat sudah tua (cloud tetap utuh).
const localTrimRule = (key: string): { field: string; hari: number } | null => {
  if (key === 'stock_movements') return { field: 'created_at', hari: TRIM_MOVEMENTS_DAYS };
  if (key === 'attendance_failures') return { field: 'timestamp', hari: TRIM_FAILURES_DAYS };
  if (key === 'production_logs') return { field: 'created_at', hari: TRIM_PRODLOGS_DAYS };
  return null;
};

const writeLocalRows = (key: string, rows: RowLike[]) => {
  applyingRemote = true;
  try {
    const rule = localTrimRule(key);
    const aman = rule
      ? trimRowsByAge(rows as unknown as Array<Record<string, unknown>>,
          rule.field, Date.now() - rule.hari * 86_400_000) as unknown as RowLike[]
      : rows;
    // Gagal tulis = storage penuh: JANGAN perbarui snapshot (mencegah deteksi
    // removal palsu) dan JANGAN banjir event (memicu reload seluruh modul).
    if (!setItemQuotaSafe(`nxty_${key}`, JSON.stringify(aman))) return;
    // Data dari cloud = baseline baru; simpan lokal berikutnya membandingkan ke sini.
    cloudSnapshot.set(key, snapshotFrom(aman));
    window.dispatchEvent(new Event('nxty_storage_change'));
  } finally {
    applyingRemote = false;
  }
};

// ===================== Pengaman anti-hapus cloud =====================
// Insiden 29 Sep 2026: satu perangkat yang daftar lokalnya hanya berisi
// karyawan bawaan (cache baru / tarikan awal gagal) menulis data karyawan,
// lalu menghapus SELURUH karyawan asli di cloud. Penghapusan terjadi di level
// DB sehingga tidak tercatat di Recycle Bin. Sejak itu, hapus di cloud wajib
// melewati pengaman berlapis di bawah — jangan pernah melonggarkan ini.
//
// Lapis 1: tanpa baseline (tarikan awal belum pernah sukses) → DILARANG hapus.
// Lapis 2: hapus hanya bila baris itu memang ada di baseline (bukan baris asing).
// Lapis 3: hapus massal dalam satu push ditolak — hampir selalu tanda daftar
//         lokal tidak lengkap, bukan penghapusan sungguhan oleh pengguna.
// Lapis 4 (server): trigger di supabase/guard-mass-delete.sql menolak hapus
//         massal langsung di database, sehingga perangkat dengan bundle lama
//         (tanpa Lapis 1-3) pun tidak bisa mengosongkan tabel.
const MASS_DELETE_MAX = 5;          // hapus > ini dalam 1 push = mencurigakan
const MASS_DELETE_MAX_RATIO = 0.25; // ...dan > 25% dari baseline = ditolak

// CATATAN: tidak ada jalan keluar (escape hatch) di sisi klien. Hapus selalu lewat
// RPC ber-token (ari_delete_rows / ari_clear_table di supabase/auth-hapus-bagian1.sql)
// yang memverifikasi sesi dan membatasi peran ke owner/admin. Policy DELETE di
// database dicabut oleh auth-hapus-bagian2-cutover.sql, jadi hapus langsung dari
// klien mana pun tidak menghapus apa pun.
/** Alasan menolak hapus (string) atau null bila hapus boleh jalan. */
const blockDeleteReason = (key: string, prev: Map<string, string> | undefined, removed: string[]): string | null => {
  if (removed.length === 0) return null;
  if (!prev) {
    return `baseline cloud "${key}" belum diketahui (tarikan awal belum sukses)`;
  }
  if (removed.length > MASS_DELETE_MAX && removed.length > prev.size * MASS_DELETE_MAX_RATIO) {
    return `hapus massal ${removed.length} dari ${prev.size} baris "${key}" — kemungkinan daftar lokal tidak lengkap`;
  }
  return null;
};

/**
 * Beri tahu pengguna saat cloud MENOLAK penghapusan. Tanpa ini penolakan hanya
 * tercatat di console, padahal akibatnya nyata: data yang sudah dihapus di
 * perangkat akan muncul lagi setelah sinkron. Dibatasi satu notifikasi per 5
 * menit supaya tidak membanjiri layar pada perangkat yang daftarnya memang
 * tidak lengkap.
 */
let lastBlockedNoticeAt = 0;
const notifyBlocked = (message: string): void => {
  const now = Date.now();
  if (now - lastBlockedNoticeAt < 5 * 60 * 1000) return;
  lastBlockedNoticeAt = now;
  window.dispatchEvent(new CustomEvent('nxty_cloud_blocked', { detail: message }));
};

/**
 * Simpan SELURUH daftar sebuah key ke Supabase secara per-baris:
 * - setiap record di-upsert (onConflict id) — aman dari tabrakan array besar,
 * - penghapusan baris WAJIB lolos pengaman berlapis (lihat blockDeleteReason).
 * No-op sampai tarikan awal sukses (cfg.ready) agar seed/migrasi perangkat baru
 * tidak pernah menghapus data asli di database.
 */
const pushRowsToCloud = (cfg: PerRowSync, list: RowLike[]): void => {
  if (!client || applyingRemote || !cfg.ready) return;
  void (async () => {
    try {
      const clean = list.filter(r => r && r.id);
      const prev = cloudSnapshot.get(cfg.key);

      if (clean.length === 0) {
        // Kosongkan tabel hanya bila baseline diketahui DAN ada hapus yang sah.
        const reason = blockDeleteReason(cfg.key, prev, prev ? [...prev.keys()] : []);
        if (reason) {
          console.warn(`[cloudSync] Tolak kosongkan "${cfg.key}": ${reason}. Tidak ada yang dihapus.`);
          notifyBlocked(`Penghapusan seluruh data "${cfg.key}" ditolak cloud: ${reason}. Data di perangkat Anda tidak jadi terhapus permanen.`);
          return;
        }
        // Policy DELETE sudah dicabut di database, jadi hapus seluruh tabel hanya
        // sah lewat RPC ini — yang memeriksa token sesi dan peran owner/admin.
        const { error } = await client!.rpc('ari_clear_table', {
          p_table: cfg.table,
          p_token: getCloudToken() ?? '',
        });
        if (error) {
          notifyBlocked(`Penghapusan seluruh data "${cfg.key}" ditolak cloud: ${error.message}`);
          throw error;
        }
        cloudSnapshot.set(cfg.key, new Map());
        if (status !== 'online') setStatus('online');
        return;
      }

      // Baris baru / berubah saja yang di-upsert (updated_at ikut ter-refresh).
      // Upsert selalu aman — menambah/memperbarui tidak pernah menghilangkan data.
      const changed = prev
        ? clean.filter(r => prev.get(r.id) !== JSON.stringify(r))
        : clean;
      if (changed.length > 0) {
        const rows = changed.map(r => ({ id: r.id, value: r, updated_at: new Date().toISOString() }));
        const { error: upErr } = await client!.from(cfg.table).upsert(rows, { onConflict: 'id' });
        if (upErr) throw upErr;
      }

      // Baris yang hilang dari daftar → hapus, HANYA bila lolos pengaman.
      if (!cfg.appendOnly && prev) {
        const currentIds = new Set(clean.map(r => r.id));
        const removed = [...prev.keys()].filter(id => !currentIds.has(id));
        const reason = blockDeleteReason(cfg.key, prev, removed);
        if (reason) {
          console.warn(`[cloudSync] Tolak hapus di "${cfg.key}": ${reason}. Tidak ada yang dihapus.`);
          notifyBlocked(`Penghapusan ${removed.length} data "${cfg.key}" ditolak cloud: ${reason}. Data di cloud tetap utuh.`);
        } else if (removed.length > 0) {
          // Policy DELETE sudah dicabut di database, jadi hapus hanya sah lewat RPC
          // ini — yang memeriksa token sesi (hasil verifikasi PIN di server) dan
          // membatasi peran ke owner/admin.
          const { error: delErr } = await client!.rpc('ari_delete_rows', {
            p_table: cfg.table,
            p_ids: removed,
            p_token: getCloudToken() ?? '',
          });
          if (delErr) {
            notifyBlocked(`Penghapusan ${removed.length} data "${cfg.key}" ditolak cloud: ${delErr.message}`);
            throw delErr;
          }
        }
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

/** Daftar id absensi yang telah dihapus dengan sengaja dari cloud (tombstone). */
const readTombstones = (): Set<string> => {
  try {
    const arr = JSON.parse(localStorage.getItem(ATT_TOMBSTONE_KEY) || '[]');
    return new Set((Array.isArray(arr) ? arr : []).filter(v => typeof v === 'string'));
  } catch { return new Set(); }
};

const writeLocalAttendance = (rows: AttendanceRecordLike[]) => {
  applyingRemote = true;
  try {
    const cutoff = Date.now() - ATTENDANCE_TRIM_DAYS * 86_400_000;
    const aman = trimAttendanceRows(
      rows as unknown as Array<Record<string, unknown>>, cutoff, readPinnedAttendanceMonths()
    ) as unknown as AttendanceRecordLike[];
    writeAttendancePruneUntil(cutoff);
    if (!setItemQuotaSafe(`nxty_${ATT_KEY}`, JSON.stringify(aman))) return;
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

/**
 * Hapus baris absensi di cloud lewat RPC ber-token. Dipakai saat membatalkan
 * koreksi admin. Perlu ini karena penghapusan absensi tidak ikut jalur
 * pushKeyToCloud (absensi dilewati di sana) — tanpa RPC, baris yang dihapus di
 * perangkat akan kembali saat sinkron berikutnya.
 */
export const deleteAttendanceRowsInCloud = (ids: string[]): void => {
  if (!client || ids.length === 0) return;
  void client.rpc('ari_delete_rows', {
    p_table: ATT_TABLE,
    p_ids: ids,
    p_token: getCloudToken() ?? '',
  }).then(({ error }) => {
    if (error) {
      console.error('[cloudSync] Gagal menghapus absensi di cloud:', error);
      notifyBlocked(`Pembatalan koreksi absensi gagal di cloud: ${error.message}`);
    }
  });
};

/** Kirim ulang scan absensi yang tertunda (mis. saat sinyal hilang). */
const flushPendingAttendance = async (): Promise<void> => {
  const tomb = readTombstones();
  const pending = readPendingAttendance().filter(r => !tomb.has(r.id));
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

/** Semua id + waktu dibuat (ari_attendance punya created_at) — untuk watermark pemangkasan lokal. */
const fetchAllIdsWithCreatedAt = async (table: string): Promise<Map<string, string>> => {
  const PAGE = 1000;
  const map = new Map<string, string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client!.from(table).select('id, created_at').range(from, from + PAGE - 1);
    if (error) throw error;
    for (const r of (data || []) as { id: string; created_at?: string }[]) if (r.id) map.set(r.id, r.created_at || '');
    if (!data || data.length < PAGE) break;
  }
  return map;
};

/**
 * Ambil baris berdasarkan DAFTAR ID — pengisi-ulang untuk daftar lokal yang
 * bolong. Sinkron bertahap hanya menarik baris yang "berubah"; baris yang
 * hilang dari perangkat (localStorage dibersihkan browser, dua perangkat
 * berbeda langkah, dsb.) tak pernah dianggap berubah dan TAK AKAN DITARIK
 * SELAMANYA — daftar keputusan ACC kelebihan/kekurangan permanen dan menu
 * "Perlu Review" jadi salah hitung. Tarik baris hilang by-id menutup itu.
 */
const fetchRowsByIds = async (table: string, ids: string[]): Promise<{ id: string; value: unknown }[]> => {
  const CHUNK = 200; // batasi panjang URL query IN
  const all: { id: string; value: unknown }[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await client!.from(table).select('id, value').in('id', ids.slice(i, i + CHUNK));
    if (error) throw error;
    all.push(...((data || []) as { id: string; value: unknown }[]));
  }
  return all;
};

/** Kumpulan baris yang hilang dari daftar lokal: id ada di cloud, tak ada lokal. */
const missingLocalIds = (localIds: Set<string>, cloudIds: Set<string>): string[] =>
  [...cloudIds].filter(id => !localIds.has(id));

/** Sama seperti di atas, tapi baris lebih tua dari watermark pemangkasan dianggap sengaja dilepas dari perangkat. */
export const missingLocalIdsWithAge = (localIds: Set<string>, idCreatedAt: Map<string, string>, watermarkMs: number): string[] =>
  [...idCreatedAt.keys()].filter(id => {
    if (localIds.has(id)) return false;
    if (watermarkMs <= 0) return true;
    const t = Date.parse(idCreatedAt.get(id) || '');
    return !Number.isFinite(t) || t > watermarkMs;
  });

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
const writeSyncNow = (): void => {
  try { localStorage.setItem(SYNC_AT_KEY, String(Date.now())); } catch { /* penuh: abaikan */ }
  markSyncSuccess();
};

// Penanda waktu "terakhir tarik-ulang penuh dari cloud" untuk tampilan di
// sidebar (indikator 1-sumber-kebenaran) — walau kolom tombol "Tersinkron ke
// Cloud" bermakna status KONEKSI realtime, bukan segar-nya data.
export const SYNC_TIME_EVENT = 'nxty_cloud_sync_time';
let lastSyncAtMs = 0;
export const getLastSyncAtMs = (): number => lastSyncAtMs;
const markSyncSuccess = (): void => {
  lastSyncAtMs = Date.now();
  try { window.dispatchEvent(new Event(SYNC_TIME_EVENT)); } catch { /* penuh: abaikan */ }
};

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
    setItemQuotaSafe(`nxty_${key}`, JSON.stringify(value));
    window.dispatchEvent(new Event('nxty_storage_change'));
  } finally {
    applyingRemote = false;
  }
};

/**
 * setItem tahan quota: bila localStorage penuh (QuotaExceededError), buang cache
 * audit log & recycle bin — keduanya murni cache, aslinya tetap utuh di cloud —
 * lalu coba sekali lagi. Bila tetap gagal, catat dan lanjutkan: SATU key yang
 * gagal tidak boleh menggagalkan seluruh sinkronisasi (bug 21 Sep 2026: satu
 * nxty_recycle_bin yang kelebihan quota membuat status "Cloud error — data lokal"
 * dan realtime mati total, padahal cloud sehat).
 */
const setItemQuotaSafe = (storageKey: string, value: string): boolean => {
  try {
    localStorage.setItem(storageKey, value);
    return true;
  } catch (e) {
    try {
      localStorage.removeItem('nxty_audit_logs');
      localStorage.removeItem('nxty_recycle_bin');
      localStorage.setItem(storageKey, value);
      console.warn(`[cloudSync] Storage penuh — cache audit/recycle dibuang untuk menulis "${storageKey}".`);
      return true;
    } catch {
      console.error(`[cloudSync] Gagal menulis "${storageKey}" ke localStorage (storage penuh?) — dilewati.`, e);
      try { window.dispatchEvent(new Event('nxty_storage_critical')); } catch { /* abaikan */ }
      return false;
    }
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
  pruneLocalHeavyData('awal');
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
        // Per-key tahan quota: satu key bermasalah tidak boleh membatalkan sisanya.
        setItemQuotaSafe(`nxty_${row.key}`, JSON.stringify(row.value));
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
      const localIds = new Set(local.map(r => r.id).filter(Boolean) as string[]);
      const tomb = readTombstones();
      if (tomb.size > 0) console.info(`[cloudSync] Nisan aktif: ${tomb.size} id absensi sudah dibersihkan dari cloud.`);
      if (incremental) {
        const cloudIdAge = await fetchAllIdsWithCreatedAt(ATT_TABLE);
        const cloudIds = new Set(cloudIdAge.keys());
        // Heal daftar bolong: baris yang tidak ada di perangkat tak akan pernah
        // lolos filter "created_at > watermark" — tarik langsung by-id (lihat
        // komentar fetchRowsByIds). Tanpa ini daftar absensi bisa selamanya kurang.
        // Baris yang sengaja dilepas dari perangkat (watermark pemangkasan) tidak
        // dianggap hilang supaya tidak ditarik ulang.
        const missing = missingLocalIdsWithAge(localIds, cloudIdAge, readAttendancePruneUntil());
        if (missing.length > 0) console.info(`[cloudSync] Mengisi ulang ${missing.length} baris absensi yang hilang dari perangkat.`);
        const refilled = missing.length > 0
          ? (await fetchRowsByIds(ATT_TABLE, missing)).map(r => r.value as AttendanceRecordLike).filter(r => r && r.id)
          : [];
        const merged = mergeRowsById(
          [...freshRecs, ...refilled] as { id: string }[],
          local as { id: string }[],
          cloudIds,
        ) as AttendanceRecordLike[];
        // Nisan: baris yang sengaja dihapus dari cloud tidak boleh menetap di
        // daftar lokal — buang, dan LARANG dikirim ulang di bawah.
        const tombTouched = merged.length !== merged.filter(r => !tomb.has(r.id)).length;
        const cleanMerged = merged.filter(r => !tomb.has(r.id));
        const localOnly = local.filter(r => r.id && !cloudIds.has(r.id) && !tomb.has(r.id));
        if (tombTouched) console.info(`[cloudSync] ${merged.length - cleanMerged.length} baris absensi nisan dibuang dari perangkat.`);
        writeLocalAttendance(sortAttendance(cleanMerged));
        for (const rec of localOnly) pushAttendanceToCloud(rec);
      } else {
        const cloudIds = new Set(freshRecs.map(r => r.id));
        const localOnly = local.filter(r => r.id && !cloudIds.has(r.id) && !tomb.has(r.id));
        writeLocalAttendance(sortAttendance([...freshRecs.filter(r => !tomb.has(r.id)), ...localOnly]));
      }
      void flushPendingAttendance();
    } catch (e) {
      console.error('[cloudSync] Gagal sinkron tabel absensi (sudah jalankan supabase/setup.sql terbaru?):', e);
    }

    // ---- Tabel per-baris ----
    let anyTableFailed = false;
    for (const cfg of PER_ROW) {
      try {
        // cfg.ready sengaja BELUM di-set di sini: push (termasuk hapus) hanya
        // boleh jalan setelah tarikan tabel ini benar-benar sukses. Kalau
        // tarikan gagal, ready tetap false sehingga tidak ada tulis/hapus yang
        // bisa menimpa cloud dengan cache perangkat yang belum lengkap.
        if (incremental) {
          const changed = (await fetchAllRows(cfg.table, { sinceCol: 'updated_at', since: since! }))
            .map(r => r.value as RowLike).filter(r => r && r.id);
          const localRows = readLocalRows(cfg.key);
          // Log append-only tidak pernah hapus baris → lewati cek id (hemat egress).
          const cloudIds = cfg.appendOnly ? null : await fetchAllIds(cfg.table);
          // Heal daftar bolong (lihat fetchRowsByIds): tanpa ini perangkat yang
          // kehilangan baris lama tak pernah mendapatkannya kembali.
          const missing = cloudIds ? missingLocalIds(new Set(localRows.map(r => r?.id).filter(Boolean)), cloudIds) : [];
          if (missing.length > 0) console.info(`[cloudSync] Mengisi ulang ${missing.length} baris "${cfg.key}" yang hilang dari perangkat.`);
          const refilled = missing.length > 0
            ? (await fetchRowsByIds(cfg.table, missing)).map(r => r.value as RowLike).filter(r => r && r.id)
            : [];
          const merged = mergeRowsById([...changed, ...refilled], localRows, cloudIds);
          if (merged.length !== localRows.length || changed.length > 0 || refilled.length > 0) writeLocalRows(cfg.key, merged);
          else cloudSnapshot.set(cfg.key, snapshotFrom(localRows));
          cfg.ready = true;
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
        cfg.ready = true;
      } catch (e) {
        anyTableFailed = true;
        console.error(`[cloudSync] Gagal sinkron tabel "${cfg.table}" (sudah jalankan supabase/setup.sql terbaru?):`, e);
      }
    }

    // Watermark hanya maju bila semua tabel tersinkron — kalau ada yang gagal,
    // pemakaian berikutnya mengulang rentang yang sama, bukan melewatinya.
    if (!anyTableFailed) writeSyncNow();
    pruneLocalHeavyData('pasca-tarik');

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
        if (!rec?.id || readTombstones().has(rec.id)) return;
        const local = readLocalAttendance();
        if (!local.some(r => r.id === rec.id)) {
          writeLocalAttendance(sortAttendance([rec, ...local]));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: ATT_TABLE }, (payload) => {
        const rec = (payload.new as { value?: AttendanceRecordLike } | null)?.value;
        if (!rec?.id || readTombstones().has(rec.id)) return;
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

// ===================== Tarik-ulang saat perangkat "bangun" =====================
// Realtime kadang putus (tab tidur, sinyal kedip) dan SECARA PASIF tak pernah
// mengejar ketinggalan; sinkron bertahap hanya jalan saat init (reload penuh).
// Karyawan yang cukup menutup layar tanpa refresh bisa berhari tidak melihat
// slip gaji / keputusan ACC / pengumuman baru. Safer berikut menutup itu:
//   - dipanggil saat halaman kembali terlihat (buka HP / pindah tab ke app),
//   - plus detak jaring pengaman tiap 5 menit selama app memang terlihat.
// Tarikannya RINGAN: hanya baris yang berubah sejak watermark terakhir
// (minus 2 jam keamanan jam perangkat), bukan menarik ulang tabel penuh.

let lastWakeupSync = 0;
let wakeupBusy = false;
const WAKEUP_SYNC_MIN_GAP_MS = 30_000;

const resyncDataOnWakeup = async (): Promise<void> => {
  if (!client || wakeupBusy) return;
  wakeupBusy = true;
  let anyFailed = false;
  try {
    const since = readSyncSince();
    if (!since) return; //belum pernah sinkron: initCloudSync yang menarik penuh

    // ---- ari_store (aturan aplikasi, brand, dll.) ----
    const { data: storeRows, error: storeErr } = await client.from(TABLE).select('key, value').gt('updated_at', since);
    if (storeErr) throw storeErr;
    for (const row of storeRows || []) {
      if (row.key === ATT_KEY || perRowByKey.has(row.key)) continue;
      applyRemoteValue(row.key, row.value);
    }

    // ---- Absensi (heal + nisan, sama dengan init inkremental) ----
    const attRows = await fetchAllRows(ATT_TABLE, { sinceCol: 'created_at', since });
    const fresh = attRows.map(r => r.value as AttendanceRecordLike).filter(r => r && r.id);
    const local = readLocalAttendance();
    if (fresh.length > 0) {
      const cloudIdAge = await fetchAllIdsWithCreatedAt(ATT_TABLE);
      const cloudIds = new Set(cloudIdAge.keys());
      const localIds = new Set(local.map(r => r.id).filter(Boolean) as string[]);
      const missing = missingLocalIdsWithAge(localIds, cloudIdAge, readAttendancePruneUntil());
      const refilled = missing.length > 0
        ? (await fetchRowsByIds(ATT_TABLE, missing)).map(r => r.value as AttendanceRecordLike).filter(r => r && r.id)
        : [];
      const tomb = readTombstones();
      const merged = mergeRowsById(
        [...fresh, ...refilled] as { id: string }[],
        local as { id: string }[],
        cloudIds,
      ) as AttendanceRecordLike[];
      writeLocalAttendance(sortAttendance(merged.filter(r => !tomb.has(r.id))));
    }
    void flushPendingAttendance();

    // ---- Tabel per-baris ----
    for (const cfg of PER_ROW) {
      try {
        const changed = (await fetchAllRows(cfg.table, { sinceCol: 'updated_at', since }))
          .map(r => r.value as RowLike).filter(r => r && r.id);
        const localRows = readLocalRows(cfg.key);
        const cloudIds = cfg.appendOnly ? null : await fetchAllIds(cfg.table);
        const missing = cloudIds ? missingLocalIds(new Set(localRows.map(r => r?.id).filter(Boolean)), cloudIds) : [];
        const refilled = missing.length > 0
          ? (await fetchRowsByIds(cfg.table, missing)).map(r => r.value as RowLike).filter(r => r && r.id)
          : [];
        const merged = mergeRowsById([...changed, ...refilled], localRows, cloudIds);
        if (merged.length !== localRows.length || changed.length > 0 || refilled.length > 0) {
          writeLocalRows(cfg.key, merged);
        } else {
          cloudSnapshot.set(cfg.key, snapshotFrom(localRows));
        }
        cfg.ready = true;
      } catch (e) {
        anyFailed = true; // watermark jangan maju: rentang sama diulang lagi
        console.error(`[cloudSync] Wakeup: gagal sinkron tabel "${cfg.table}"`, e);
      }
    }

    // Watermark hanya maju bila tarikan ini benar-benar sukses semua.
    if (!anyFailed) {
      writeSyncNow();
      if (status !== 'online') setStatus('online');
    }
    pruneLocalHeavyData('wakeup');
  } catch (e) {
    console.error('[cloudSync] Wakeup sinkron gagal:', e);
  } finally {
    wakeupBusy = false;
  }
};

// ==== Perawatan storage perangkat ====
// localStorage hanya ±5 MB per perangkat sementara dataset tumbuh tiap hari.
// Semuanya HANYA menulis ulang cache lokal — cloud tidak pernah disentuh:
// - penulis lokal (writeLocalRows/writeLocalAttendance) memangkas & mengompaksi
//   saat menulis, jadi puncak pemakaian saat tarikan pun sudah kecil,
// - riwayat absensi >90 hari dilepas dari perangkat (bulan yang sedang dibuka
//   di-pin) dan dicatat watermark-nya supaya heal tidak menariknya ulang;
//   saat dibuka lagi, riwayat itu diambil dari cloud (ensureAttendanceHistory).
const PRUNE_THRESHOLD = 0.6;
const COMPACT_ATTENDANCE_DAYS = 30;
const TRIM_MOVEMENTS_DAYS = 90;
const TRIM_FAILURES_DAYS = 30;
const TRIM_PRODLOGS_DAYS = 60;
const ATTENDANCE_TRIM_DAYS = 90;
const ATT_PRUNE_KEY = 'nxty_att_prune_until';
const ATT_PIN_KEY = 'nxty_att_pinned_months';
const PRUNE_MIN_GAP_MS = 5 * 60 * 1000;
const DROP_FIELDS_COMPACT = new Set([
  'latitude', 'longitude', 'distance_meters', 'accuracy',
  'device_token', 'verification_method', 'selfie_url',
  'overtime_request', 'is_mock_location_flag',
]);

/** Kompaksi baris absensi yang sudah lama: inti data dipertahankan, baris koreksi tidak disentuh. */
export const compactAttendanceRows = (
  rows: Array<Record<string, unknown>>, cutoffMs: number
): { rows: Array<Record<string, unknown>>; compacted: number } => {
  let compacted = 0;
  const out = rows.map(row => {
    const ts = Date.parse(String(row.timestamp || ''));
    if (!Number.isFinite(ts) || ts > cutoffMs) return row;
    if (row.device_token === 'koreksi-admin') return row;
    let kena = false;
    const ringkas: Record<string, unknown> = {};
    for (const k of Object.keys(row)) {
      if (DROP_FIELDS_COMPACT.has(k)) { kena = true; continue; }
      ringkas[k] = row[k];
    }
    if (kena) compacted++;
    return ringkas;
  });
  return { rows: out, compacted };
};

/** Lepas baris lebih tua dari cutoff; baris tanpa tanggal disimpan (konservatif). */
export const trimRowsByAge = <T extends Record<string, unknown>>(rows: T[], ageField: string, cutoffMs: number): T[] =>
  rows.filter(row => {
    const ts = Date.parse(String(row[ageField] ?? ''));
    return !Number.isFinite(ts) || ts > cutoffMs;
  });

/** Lepas absensi lebih tua dari cutoff; baris koreksi & bulan yang dibuka user tetap disimpan. */
export const trimAttendanceRows = <T extends Record<string, unknown>>(rows: T[], cutoffMs: number, pinnedMonths: Set<string>): T[] =>
  rows.filter(row => {
    if (row.device_token === 'koreksi-admin') return true;
    const ts = Date.parse(String(row.timestamp ?? ''));
    if (!Number.isFinite(ts) || ts > cutoffMs) return true;
    const bulan = String(row.timestamp ?? '').slice(0, 7);
    return Boolean(bulan) && pinnedMonths.has(bulan);
  });

const readPinnedAttendanceMonths = (): Set<string> => {
  try {
    const raw = localStorage.getItem(ATT_PIN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
};
const pinAttendanceMonthsForRange = (start: string, end: string): void => {
  try {
    const months = new Set<string>();
    const kursor = new Date(`${start.slice(0, 10)}T00:00:00+07:00`);
    const bulanAkhir = end.slice(0, 7);
    for (let jaga = 0; jaga < 60; jaga++) {
      const bulan = `${kursor.getFullYear()}-${String(kursor.getMonth() + 1).padStart(2, '0')}`;
      months.add(bulan);
      if (bulan === bulanAkhir) break;
      kursor.setMonth(kursor.getMonth() + 1);
    }
    months.add(end.slice(0, 7));
    localStorage.setItem(ATT_PIN_KEY, JSON.stringify([...months]));
  } catch { /* penuh: abaikan */ }
};

/**
 * Pastikan riwayat absensi untuk rentang tanggal ada di cache lokal: rentang yang
 * sudah dilepas dari perangkat (>90 hari) diambil dari cloud lalu digabung dedup
 * by-id. Bulan yang diminta di-pin supaya tidak terpangkas selagi dilihat user.
 * Hanya MEMBACA cloud — tidak pernah mengubah data di sana.
 */
export const ensureAttendanceHistory = async (start: string, end: string): Promise<number> => {
  if (!client) return 0;
  const HARI = 86_400_000;
  const batasJendela = Date.now() - ATTENDANCE_TRIM_DAYS * HARI;
  if (Date.parse(start) >= batasJendela) return 0;
  const { data, error } = await client.from(ATT_TABLE).select('id, value')
    .filter('value->>timestamp', 'gte', start)
    .filter('value->>timestamp', 'lte', end);
  if (error) {
    console.error('[cloudSync] Gagal mengambil riwayat absensi dari cloud:', error);
    return 0;
  }
  const tomb = readTombstones();
  const remote = (data || []).map(r => r.value as AttendanceRecordLike)
    .filter(r => r && r.id && !tomb.has(r.id));
  pinAttendanceMonthsForRange(start, end);
  if (!remote.length) return 0;
  const local = readLocalAttendance();
  const localIds = new Set(local.map(r => r.id).filter(Boolean) as string[]);
  const baru = remote.filter(r => !localIds.has(r.id));
  if (!baru.length) return 0;
  const ringkas = compactAttendanceRows(
    baru as unknown as Array<Record<string, unknown>>, Date.now() - COMPACT_ATTENDANCE_DAYS * HARI
  ).rows;
  writeLocalAttendance(sortAttendance([...(ringkas as unknown as AttendanceRecordLike[]), ...local]));
  console.info(`[cloudSync] Menarik ${baru.length} riwayat absensi dari cloud (${start} s.d. ${end}).`);
  return baru.length;
};

export const getLocalUsageRatio = (): number => {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('nxty_')) total += (localStorage.getItem(k) || '').length;
  }
  return total / (5 * 1024 * 1024);
};
const readAttendancePruneUntil = (): number => {
  try { return Number(localStorage.getItem(ATT_PRUNE_KEY)) || 0; } catch { return 0; }
};
const writeAttendancePruneUntil = (ms: number): void => {
  try {
    localStorage.setItem(ATT_PRUNE_KEY, String(Math.max(readAttendancePruneUntil(), ms)));
  } catch { /* penuh: abaikan */ }
};

let lastLocalPruneAt = 0;
export const pruneLocalHeavyData = (sumber: string): void => {
  try {
    const usage = getLocalUsageRatio();
    if (usage <= PRUNE_THRESHOLD) return;
    if (sumber !== 'awal' && Date.now() - lastLocalPruneAt < PRUNE_MIN_GAP_MS) return;
    lastLocalPruneAt = Date.now();
    const now = Date.now();
    const HARI = 86_400_000;
    let berubah = false;

    const att = readLocalAttendance();
    const { rows: attRingkas, compacted } = compactAttendanceRows(
      att as unknown as Array<Record<string, unknown>>, now - COMPACT_ATTENDANCE_DAYS * HARI
    );
    if (compacted > 0) {
      writeLocalAttendance(attRingkas as unknown as AttendanceRecordLike[]);
      berubah = true;
      console.info(`[cloudSync] Kompaksi ${compacted} baris absensi lama (GPS/verifikasi dilepas dari cache, data tetap utuh di cloud).`);
    }

    const targets: Array<{ key: string; field: string; hari: number; label: string }> = [
      { key: 'stock_movements', field: 'created_at', hari: TRIM_MOVEMENTS_DAYS, label: 'mutasi stok' },
      { key: 'attendance_failures', field: 'timestamp', hari: TRIM_FAILURES_DAYS, label: 'scan gagal' },
      { key: 'production_logs', field: 'created_at', hari: TRIM_PRODLOGS_DAYS, label: 'log produksi' },
    ];
    for (const t of targets) {
      const rows = readLocalRows(t.key);
      if (!rows.length) continue;
      const kept = trimRowsByAge(rows as unknown as Array<Record<string, unknown>>, t.field, now - t.hari * HARI);
      if (kept.length !== rows.length) {
        writeLocalRows(t.key, kept as { id: string }[]);
        berubah = true;
        console.info(`[cloudSync] Melepas ${rows.length - kept.length} ${t.label} >${t.hari} hari dari cache (aman di cloud).`);
      }
    }

    // Riwayat absensi >90 hari dilepas dari perangkat (bulan yang dibuka user di-pin).
    const attKini = readLocalAttendance();
    const cutoffAbsen = now - ATTENDANCE_TRIM_DAYS * HARI;
    const keptAtt = trimAttendanceRows(
      attKini as unknown as Array<Record<string, unknown>>, cutoffAbsen, readPinnedAttendanceMonths()
    );
    if (keptAtt.length !== attKini.length) {
      writeAttendancePruneUntil(cutoffAbsen);
      writeLocalAttendance(keptAtt as unknown as AttendanceRecordLike[]);
      berubah = true;
      console.info(`[cloudSync] Melepas ${attKini.length - keptAtt.length} absensi >${ATTENDANCE_TRIM_DAYS} hari dari cache (aman di cloud; bulan yang dibuka ditarik ulang otomatis).`);
    }
    if (berubah) console.info(`[cloudSync] Perawatan storage (${sumber}): ${Math.round(usage * 100)}% -> ${Math.round(getLocalUsageRatio() * 100)}%.`);
  } catch (e) {
    console.error('[cloudSync] Perawatan storage gagal (dilewati):', e);
  }
};

/** Tarik ulang manual dari UI; bila belum pernah sinkron, jalankan tarik penuh. */
export const resyncDataNow = async (): Promise<void> => {
  if (!client) return;
  lastWakeupSync = Date.now();
  if (readSyncSince() === null) {
    await initCloudSync();
    return;
  }
  await resyncDataOnWakeup();
};

const tryWakeupSync = (): void => {
  if (!client) return;
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (now - lastWakeupSync < WAKEUP_SYNC_MIN_GAP_MS) return;
  lastWakeupSync = now;
  void resyncDataOnWakeup();
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', tryWakeupSync);
  setInterval(tryWakeupSync, 5 * 60 * 1000);
}
