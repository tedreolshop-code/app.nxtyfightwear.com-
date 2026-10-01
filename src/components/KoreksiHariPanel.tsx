import React, { useState } from 'react';
import { Attendance, Employee } from '../types';
import { dataStore, wibTodayStr } from '../dataStore';

/** Harus sama dengan dataStore.KOREKSI_MAX_HARI. */
const KOREKSI_HARI = 30;

/**
 * Koreksi satu hari langsung dari kalender admin: klik tanggal, perbaiki di situ.
 *
 * Sengaja HANYA dipasang oleh pemanggil admin (Data Karyawan). Kalender yang sama
 * dipakai portal karyawan, dan karyawan tidak boleh mengoreksi absensinya sendiri.
 *
 * Bentuknya cuma UI: seluruh aturan (jendela 30 hari, alasan wajib, tolak scan
 * ganda, hapus di cloud lewat RPC) ada di dataStore.
 */
export const KoreksiHariPanel: React.FC<{
  employee: Employee;
  date: string;
  dayLogs: Attendance[];
  onDone: () => void;
}> = ({ employee, date, dayLogs, onDone }) => {
  const settings = dataStore.getWorkSettings();
  const today = wibTodayStr();
  const [masuk, setMasuk] = useState(settings.start_time);
  const [pulang, setPulang] = useState(settings.end_time);
  const [alasan, setAlasan] = useState('');
  const [alasanBatal, setAlasanBatal] = useState('');
  const [pesan, setPesan] = useState<{ text: string; error: boolean } | null>(null);

  const masukLog = dayLogs.find(l => l.type_scan === 'masuk');
  const pulangLog = dayLogs.find(l => l.type_scan === 'pulang');
  const koreksiAdmin = dayLogs.filter(l => l.device_token === 'koreksi-admin');

  // Kenapa hari ini tidak bisa dikoreksi (dataStore tetap penjaga terakhirnya).
  const halangan = (() => {
    if (date > today) return 'Tanggal belum terjadi.';
    const batas = new Date(new Date(`${today}T00:00:00Z`).getTime() - KOREKSI_HARI * 86400000)
      .toISOString().slice(0, 10);
    if (date < batas) return `Di luar jendela koreksi ${KOREKSI_HARI} hari terakhir.`;
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) return 'Hari Minggu libur — tidak dihitung.';
    if (employee.join_date && date < employee.join_date) return 'Sebelum tanggal mulai kerja karyawan ini.';
    return null;
  })();

  const simpan = (jenis: 'masuk' | 'pulang' | 'keduanya') => {
    try {
      if (jenis !== 'pulang') dataStore.recordMissingCheckin(employee.id, date, masuk, alasan);
      if (jenis !== 'masuk') dataStore.recordMissingCheckout(employee.id, date, pulang, alasan);
      setPesan({ text: 'Koreksi tersimpan.', error: false });
      setAlasan('');
      onDone();
    } catch (err) {
      setPesan({ text: err instanceof Error ? err.message : 'Koreksi gagal.', error: true });
    }
  };

  const batalkan = (attendanceId: string) => {
    try {
      dataStore.deleteAttendanceCorrection(attendanceId, alasanBatal);
      setPesan({ text: 'Koreksi dibatalkan.', error: false });
      setAlasanBatal('');
      onDone();
    } catch (err) {
      setPesan({ text: err instanceof Error ? err.message : 'Gagal membatalkan koreksi.', error: true });
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-gray-200 space-y-2" role="group" aria-label={`Koreksi hari ${date}`}>
      {pesan && (
        <p role="status" className={`text-[11px] font-bold rounded-lg p-2 border ${pesan.error ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {pesan.text}
        </p>
      )}

      {koreksiAdmin.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-gray-700">Hari ini berisi koreksi admin. Batalkan dulu bila ingin mencatat ulang.</p>
          {koreksiAdmin.map(l => (
            <div key={l.id} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <span className="text-[11px] text-gray-600 flex-1">
                {l.type_scan} {l.timestamp.slice(11, 16)} · oleh {l.assisted_by_name || 'admin'}
                {l.assistance_reason ? ` · ${l.assistance_reason}` : ''}
              </span>
              <input
                type="text"
                value={alasanBatal}
                onChange={e => setAlasanBatal(e.target.value)}
                placeholder="Alasan pembatalan (wajib)"
                aria-label={`Alasan pembatalan koreksi ${date}`}
                className="border border-gray-200 rounded-lg p-1.5 text-[11px]"
              />
              <button
                type="button"
                onClick={() => batalkan(l.id)}
                disabled={!alasanBatal.trim()}
                className="rounded-lg bg-white border border-rose-200 text-rose-700 font-bold px-3 py-1.5 text-[11px] disabled:opacity-40"
              >
                Batalkan Koreksi
              </button>
            </div>
          ))}
        </div>
      ) : halangan ? (
        <p className="text-[11px] text-gray-500">{halangan}</p>
      ) : masukLog && pulangLog ? (
        <p className="text-[11px] text-gray-500">
          Scan hari ini sudah lengkap (masuk {masukLog.timestamp.slice(11, 16)} · pulang {pulangLog.timestamp.slice(11, 16)}).
          Mengubah jam yang sudah tercatat belum didukung — koreksi hanya untuk scan yang hilang.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-gray-700">
            {masukLog ? 'Ada scan masuk, belum ada scan pulang.'
              : pulangLog ? 'Ada scan pulang, belum ada scan masuk.'
              : 'Belum ada scan sama sekali hari ini.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {!masukLog && (
              <label className="flex items-center gap-1.5 text-[11px]">
                <span className="font-bold text-gray-500">Masuk</span>
                <input
                  type="time"
                  value={masuk}
                  onChange={e => setMasuk(e.target.value)}
                  aria-label={`Jam masuk koreksi ${date}`}
                  className="border border-gray-200 rounded-lg p-1.5"
                />
              </label>
            )}
            {!pulangLog && (
              <label className="flex items-center gap-1.5 text-[11px]">
                <span className="font-bold text-gray-500">Pulang</span>
                <input
                  type="time"
                  value={pulang}
                  onChange={e => setPulang(e.target.value)}
                  aria-label={`Jam pulang koreksi ${date}`}
                  className="border border-gray-200 rounded-lg p-1.5"
                />
              </label>
            )}
            <input
              type="text"
              value={alasan}
              onChange={e => setAlasan(e.target.value)}
              placeholder="Alasan koreksi (wajib)"
              aria-label={`Alasan koreksi ${date}`}
              className="flex-1 border border-gray-200 rounded-lg p-1.5 text-[11px]"
            />
            <button
              type="button"
              onClick={() => simpan(!masukLog && !pulangLog ? 'keduanya' : !masukLog ? 'masuk' : 'pulang')}
              disabled={!alasan.trim()}
              className="rounded-lg bg-[var(--color-evergreen)] text-white font-bold px-3 py-1.5 text-[11px] disabled:opacity-40"
            >
              Simpan Koreksi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
