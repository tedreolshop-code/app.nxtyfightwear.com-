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
// Karyawan disimpan SATU BARIS PER KARYAWAN di tabel terpisah, dengan Supabase
// sebagai sumber data utama (upsert/hapus per baris — tidak ada array besar yang
// saling menimpa). Lihat pushEmployeesToCloud & jalur employees di initCloudSync.
const EMP_TABLE = 'ari_employees';
const EMP_KEY = 'employees';

export const isCloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

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

// Gerbang kesiapan karyawan: selama tarikan awal dari Supabase belum selesai,
// tulisan karyawan (mis. data contoh/seed atau migrasi) TIDAK boleh di-push,
// supaya tidak menimpa/menghapus data yang sebenarnya sudah ada di database.
// Saat cloud tidak dikonfigurasi, langsung dianggap siap (mode offline biasa).
let employeesReady = !isCloudEnabled;
export const isEmployeesReady = () => employeesReady;

// Debounce push per key supaya input beruntun tidak membanjiri jaringan
const pendingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

// ===================== Jalur khusus karyawan (per baris) =====================

type EmployeeLike = { id: string };

const readLocalEmployees = (): EmployeeLike[] => {
  try { return JSON.parse(localStorage.getItem(`nxty_${EMP_KEY}`) || '[]'); } catch { return []; }
};

const writeLocalEmployees = (rows: EmployeeLike[]) => {
  applyingRemote = true;
  try {
    localStorage.setItem(`nxty_${EMP_KEY}`, JSON.stringify(rows));
    window.dispatchEvent(new Event('nxty_storage_change'));
  } finally {
    applyingRemote = false;
  }
};

/**
 * Simpan SELURUH daftar karyawan ke Supabase secara per-baris:
 * - setiap karyawan di-upsert (onConflict id) — aman dari tabrakan array besar,
 * - karyawan yang tidak lagi ada di daftar dihapus dari database.
 * No-op sampai tarikan awal selesai (employeesReady) agar seed/migrasi tidak
 * menghapus data asli di database sebelum kita membacanya.
 */
export const pushEmployeesToCloud = (list: EmployeeLike[]): void => {
  if (!client || applyingRemote || !employeesReady) return;
  void (async () => {
    try {
      if (list.length > 0) {
        const rows = list.map(emp => ({ id: emp.id, value: emp, updated_at: new Date().toISOString() }));
        const { error: upErr } = await client!.from(EMP_TABLE).upsert(rows, { onConflict: 'id' });
        if (upErr) throw upErr;
        const keep = `(${list.map(emp => `"${emp.id}"`).join(',')})`;
        const { error: delErr } = await client!.from(EMP_TABLE).delete().not('id', 'in', keep);
        if (delErr) throw delErr;
      } else {
        const { error } = await client!.from(EMP_TABLE).delete().neq('id', '');
        if (error) throw error;
      }
      if (status !== 'online') setStatus('online');
    } catch (e) {
      console.error('[cloudSync] Gagal menyimpan karyawan ke Supabase:', e);
      setStatus('error');
    }
  })();
};

/** Push satu key (tanpa prefix nxty_) ke Supabase. Dipanggil dataStore setiap kali menulis. */
export const pushKeyToCloud = (key: string, data: unknown): void => {
  if (!client || applyingRemote) return;
  // Absensi TIDAK ikut jalur array utuh — punya jalur per-baris sendiri (pushAttendanceToCloud).
  if (key === ATT_KEY) return;
  // Karyawan juga punya jalur per-baris sendiri (Supabase = sumber data utama).
  if (key === EMP_KEY) { pushEmployeesToCloud(data as EmployeeLike[]); return; }
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
        if (row.key === EMP_KEY) continue; // karyawan diabaikan — pakai tabel per-baris (ari_employees)
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

    // Karyawan: Supabase adalah sumber data utama. Tarik semua baris dan jadikan
    // itu isi karyawan lokal. Bila database masih kosong (instalasi baru), unggah
    // data lokal (seed) sebagai isian awal. Setelah ini employeesReady = true,
    // sehingga tambah/edit/hapus karyawan mulai tersimpan langsung ke database.
    try {
      const { data: empRows, error: empErr } = await client.from(EMP_TABLE).select('id, value');
      if (empErr) throw empErr;
      const cloudEmps = (empRows || [])
        .map(r => r.value as EmployeeLike)
        .filter(r => r && r.id);
      employeesReady = true;
      if (cloudEmps.length > 0) {
        writeLocalEmployees(cloudEmps);
      } else {
        const local = readLocalEmployees();
        if (local.length > 0) pushEmployeesToCloud(local);
      }
    } catch (e) {
      // Tabel belum dibuat (setup.sql terbaru belum dijalankan) → jalan lokal saja.
      employeesReady = true;
      console.error('[cloudSync] Gagal sinkron tabel karyawan (sudah jalankan supabase/setup.sql terbaru?):', e);
    }

    // Realtime: perubahan dari perangkat lain langsung masuk
    client
      .channel('ari_store_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        const row = payload.new as { key?: string; value?: unknown } | null;
        if (row && row.key !== undefined && row.key !== ATT_KEY && row.key !== EMP_KEY) {
          applyRemoteValue(row.key, row.value);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: EMP_TABLE }, (payload) => {
        const rec = (payload.new as { value?: EmployeeLike } | null)?.value;
        if (!rec?.id) return;
        const local = readLocalEmployees();
        if (!local.some(r => r.id === rec.id)) writeLocalEmployees([...local, rec]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: EMP_TABLE }, (payload) => {
        const rec = (payload.new as { value?: EmployeeLike } | null)?.value;
        if (!rec?.id) return;
        const local = readLocalEmployees();
        writeLocalEmployees(local.some(r => r.id === rec.id)
          ? local.map(r => r.id === rec.id ? rec : r)
          : [...local, rec]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: EMP_TABLE }, (payload) => {
        const oldId = (payload.old as { id?: string } | null)?.id;
        if (!oldId) return;
        writeLocalEmployees(readLocalEmployees().filter(r => r.id !== oldId));
      })
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
