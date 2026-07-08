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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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
  { key: 'employees', table: 'ari_employees', ready: !isCloudEnabled },
  { key: 'products', table: 'ari_products', ready: !isCloudEnabled },
  { key: 'raw_materials', table: 'ari_raw_materials', ready: !isCloudEnabled },
  { key: 'stock_movements', table: 'ari_stock_movements', ready: !isCloudEnabled, appendOnly: true },
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

const writeLocalRows = (key: string, rows: RowLike[]) => {
  applyingRemote = true;
  try {
    localStorage.setItem(`nxty_${key}`, JSON.stringify(rows));
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
      if (clean.length > 0) {
        const rows = clean.map(r => ({ id: r.id, value: r, updated_at: new Date().toISOString() }));
        const { error: upErr } = await client!.from(cfg.table).upsert(rows, { onConflict: 'id' });
        if (upErr) throw upErr;
        // Log append-only: jangan hapus baris lama (filter NOT IN bisa membengkak).
        if (!cfg.appendOnly) {
          const keep = `(${clean.map(r => `"${r.id}"`).join(',')})`;
          const { error: delErr } = await client!.from(cfg.table).delete().not('id', 'in', keep);
          if (delErr) throw delErr;
        }
      } else {
        const { error } = await client!.from(cfg.table).delete().neq('id', '');
        if (error) throw error;
      }
      if (status !== 'online') setStatus('online');
    } catch (e) {
      console.error(`[cloudSync] Gagal menyimpan "${cfg.key}" ke Supabase:`, e);
      setStatus('error');
    }
  })();
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
      .upsert({ id: record.id, value: record }, { onConflict: 'id' });
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

const sortAttendance = (rows: AttendanceRecordLike[]) =>
  rows.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

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
 * Tarik seluruh data dari Supabase ke localStorage, lalu dengarkan perubahan realtime.
 * Panggil sekali saat aplikasi start. Aman dipanggil saat cloud tidak dikonfigurasi (no-op).
 */
export const initCloudSync = async (): Promise<void> => {
  if (!client) return;
  setStatus('connecting');
  try {
    const { data, error } = await client.from(TABLE).select('key, value');
    if (error) throw error;

    applyingRemote = true;
    try {
      for (const row of data || []) {
        if (row.key === ATT_KEY) continue; // absensi model lama diabaikan — pakai tabel per-baris
        if (perRowByKey.has(row.key)) continue; // key per-baris diabaikan — pakai tabelnya sendiri
        localStorage.setItem(`nxty_${row.key}`, JSON.stringify(row.value));
      }
    } finally {
      applyingRemote = false;
    }
    if (data && data.length > 0) {
      window.dispatchEvent(new Event('nxty_storage_change'));
    }

    // Absensi: tarik semua baris dari cloud, gabung dengan lokal berdasarkan id,
    // lalu push balik scan yang hanya ada di lokal (mis. direkam saat offline).
    try {
      const { data: attRows, error: attErr } = await client.from(ATT_TABLE).select('id, value');
      if (attErr) throw attErr;
      const cloudRecs = (attRows || [])
        .map(r => r.value as AttendanceRecordLike)
        .filter(r => r && r.id);
      const cloudIds = new Set(cloudRecs.map(r => r.id));
      const localOnly = readLocalAttendance().filter(r => r.id && !cloudIds.has(r.id));
      writeLocalAttendance(sortAttendance([...cloudRecs, ...localOnly]));
      for (const rec of localOnly) pushAttendanceToCloud(rec);
      void flushPendingAttendance();
    } catch (e) {
      console.error('[cloudSync] Gagal sinkron tabel absensi (sudah jalankan supabase/setup.sql terbaru?):', e);
    }

    // Key per-baris (karyawan, produk, bahan baku, mutasi stok): Supabase adalah
    // sumber data utama. Tarik semua baris dan jadikan itu isi lokal. Bila database
    // masih kosong (instalasi baru), unggah data lokal (seed) sebagai isian awal.
    // Setelah ini cfg.ready = true, sehingga tambah/edit/hapus mulai tersimpan
    // langsung ke database dan tidak bisa "hilang kembali ke data awal".
    for (const cfg of PER_ROW) {
      try {
        const { data: rows, error: rowErr } = await client.from(cfg.table).select('id, value');
        if (rowErr) throw rowErr;
        const cloudRows = (rows || [])
          .map(r => r.value as RowLike)
          .filter(r => r && r.id);
        cfg.ready = true;
        if (cloudRows.length > 0) {
          writeLocalRows(cfg.key, cloudRows);
        } else {
          const local = readLocalRows(cfg.key);
          if (local.length > 0) pushRowsToCloud(cfg, local);
        }
      } catch (e) {
        // Tabel belum dibuat (setup.sql terbaru belum dijalankan) → jalan lokal saja.
        cfg.ready = true;
        console.error(`[cloudSync] Gagal sinkron tabel "${cfg.table}" (sudah jalankan supabase/setup.sql terbaru?):`, e);
      }
    }

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
