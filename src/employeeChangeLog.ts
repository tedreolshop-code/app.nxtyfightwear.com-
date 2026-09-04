import { AuditEntry, Employee, divisionLabel, employmentStatusOf, EMPLOYMENT_STATUSES } from './types';

/**
 * Jejak perubahan gaji karyawan.
 *
 * Tidak ada data baru yang disimpan: dataStore sudah menulis audit 'update'
 * berisi snapshot before/after tiap kali karyawan disimpan. Di sini snapshot
 * itu tinggal dibandingkan supaya jadi baris "dari X jadi Y" yang terbaca.
 */

type Formatter = (value: unknown) => string;

const rupiah = (value: unknown) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

// Field yang dilacak + cara menampilkannya. Di luar daftar ini diabaikan
// supaya perubahan teknis (foto, token, urutan tab) tidak jadi kebisingan.
const TRACKED: Record<string, { label: string; format: Formatter }> = {
  rate_harian: { label: 'Rate harian', format: rupiah },
  rate_lembur_per_jam: { label: 'Lembur per jam', format: rupiah },
  default_live_tiktok_bonus: { label: 'Bonus Live TikTok', format: rupiah },
  default_attendance_bonus: { label: 'Bonus kehadiran / hari', format: rupiah },
  default_weekly_cash_advance_deduction: { label: 'Potongan kasbon mingguan', format: rupiah },
  employment_status: {
    label: 'Status kepegawaian',
    format: value => EMPLOYMENT_STATUSES.find(s => s.id === employmentStatusOf({ employment_status: value as Employee['employment_status'] }))?.label
      || String(value ?? '-'),
  },
  department_id: { label: 'Divisi', format: value => divisionLabel(value as string) },
  employee_number: { label: 'Nomor induk', format: value => String(value ?? '-') },
  join_date: { label: 'Tanggal masuk', format: value => String(value ?? '-') },
  status_aktif: { label: 'Status aktif', format: value => (value ? 'Aktif' : 'Nonaktif') },
  role: { label: 'Jabatan', format: value => (value === 'leader' ? 'Leader' : 'Karyawan') },
  access_role: {
    label: 'Akses sistem',
    format: value => ({
      '': 'Karyawan',
      admin_penjualan: 'Admin Penjualan',
      admin_gudang: 'Gudang & Produksi',
      owner: 'Owner',
    }[String(value ?? '')] || String(value ?? 'Karyawan')),
  },
};

export interface FieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface ChangeEntry {
  id: string;
  timestamp: string;
  actor_name: string;
  changes: FieldChange[];
}

const snapshotOf = (entry: AuditEntry, side: 'before' | 'after'): Record<string, unknown> => {
  const value = entry.metadata?.[side];
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
};

/** Riwayat perubahan gaji satu karyawan, terbaru di atas. */
export const employeeChangeLog = (logs: AuditEntry[], employeeId: string): ChangeEntry[] =>
  logs
    .filter(log => log.entity_type === 'employees' && log.entity_id === employeeId && log.action === 'update')
    .map(log => {
      const before = snapshotOf(log, 'before');
      const after = snapshotOf(log, 'after');
      const changes = Object.entries(TRACKED).flatMap(([field, { label, format }]) => {
        // Field baru yang belum pernah ada di data lama bukan perubahan gaji, cuma migrasi
        if (!(field in before) && !(field in after)) return [];
        if (before[field] === after[field]) return [];
        return [{ field, label, from: format(before[field]), to: format(after[field]) }];
      });
      return { id: log.id, timestamp: log.timestamp, actor_name: log.actor_name, changes };
    })
    .filter(entry => entry.changes.length > 0)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
