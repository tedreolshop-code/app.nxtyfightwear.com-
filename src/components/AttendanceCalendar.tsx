import React, { useMemo, useState } from 'react';
import { Attendance } from '../types';
import { dataStore, wibTodayStr, dayFraction } from '../dataStore';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

type DayKind = 'hadir' | 'catatan' | 'anomali' | 'absen' | 'libur' | 'belum-berlaku' | 'belum-dinilai';

interface DayInfo {
  kind: DayKind;
  label: string;                // ringkas untuk tooltip / detail
  masuk?: string;               // 'HH:MM'
  pulang?: string;
  lateMinutes?: number;
  logs: Attendance[];
}

const KIND_STYLE: Record<DayKind, string> = {
  hadir: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  catatan: 'bg-amber-100 border-amber-300 text-amber-900',
  anomali: 'bg-amber-100 border-amber-300 text-amber-900',
  absen: 'bg-rose-100 border-rose-300 text-rose-800',
  libur: 'bg-slate-50 border-slate-100 text-slate-300',
  'belum-berlaku': 'bg-slate-50 border-slate-100 text-slate-300',
  'belum-dinilai': 'bg-gray-50 border-gray-200 text-gray-400',
};

/**
 * Kalender kehadiran satu karyawan. Dipakai portal karyawan (transparansi ke
 * pemilik data) DAN admin (verifikasi). Sengaja membedakan "tidak hadir" dari
 * "libur / belum berlaku / belum dinilai" supaya karyawan tidak salah paham
 * mengira hari libur atau hari sebelum ia masuk dihitung mangkir.
 */
export const AttendanceCalendar: React.FC<{
  logs: Attendance[];
  joinDate?: string;
  showLocation?: boolean;
  initialMonth?: string;
}> = ({ logs, joinDate, showLocation = false, initialMonth }) => {
  const today = wibTodayStr();
  const settings = dataStore.getWorkSettings();
  const effectiveFrom = settings.attendance_effective_from;
  const [month, setMonth] = useState(initialMonth || today.slice(0, 7));
  const [selected, setSelected] = useState<string>('');

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const firstDow = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();

  // Batas navigasi: tidak boleh ke masa depan; mundur maksimal ke bulan join / 24 bulan.
  const minMonth = (() => {
    const floor = new Date(); floor.setUTCMonth(floor.getUTCMonth() - 24);
    const joinMonth = joinDate?.slice(0, 7);
    const base = floor.toISOString().slice(0, 7);
    return joinMonth && joinMonth > base ? joinMonth : base;
  })();
  const maxMonth = today.slice(0, 7);
  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
    setSelected('');
  };

  const byDate = useMemo(() => {
    const map = new Map<string, Attendance[]>();
    for (const l of logs) {
      const d = l.timestamp.slice(0, 10);
      if (!d.startsWith(month)) continue;
      map.set(d, [...(map.get(d) || []), l]);
    }
    return map;
  }, [logs, month]);

  const dayInfo = (dateStr: string): DayInfo => {
    const dayLogs = byDate.get(dateStr) || [];
    const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
    const masukLog = dayLogs.find(l => l.type_scan === 'masuk');
    const pulangLog = [...dayLogs].reverse().find(l => l.type_scan === 'pulang');
    const masuk = masukLog?.timestamp.slice(11, 16);
    const pulang = pulangLog?.timestamp.slice(11, 16);
    const lateMinutes = masukLog?.late_minutes || 0;

    // 1. Ada scan → tampilkan apa adanya (data milik karyawan sendiri).
    if (dayLogs.length > 0) {
      if (dayLogs.some(l => l.status === 'anomaly')) {
        return { kind: 'anomali', label: 'Scan di luar radius pabrik (data lama)', masuk, pulang, lateMinutes, logs: dayLogs };
      }
      const fraction = dayFraction(dayLogs, settings);
      const catatan: string[] = [];
      if (lateMinutes > 0) catatan.push(`telat ${lateMinutes} mnt`);
      if (!pulang) catatan.push('tanpa scan pulang');
      else if (fraction === 0.5) catatan.push('setengah hari');
      else if (pulangLog?.early_leave_reason) catatan.push('pulang cepat');
      if (catatan.length > 0) {
        return { kind: 'catatan', label: catatan.join(' · '), masuk, pulang, lateMinutes, logs: dayLogs };
      }
      return { kind: 'hadir', label: 'Hadir penuh, tepat waktu', masuk, pulang, lateMinutes, logs: dayLogs };
    }

    // 2. Tidak ada scan — bedakan sebabnya, jangan asal "mangkir".
    if (dow === 0) return { kind: 'libur', label: 'Minggu — libur, tidak dihitung', logs: [] };
    if (joinDate && dateStr < joinDate) return { kind: 'belum-berlaku', label: 'Sebelum tanggal mulai kerja', logs: [] };
    if (effectiveFrom && dateStr < effectiveFrom) return { kind: 'belum-berlaku', label: 'Sebelum absensi mulai dipakai', logs: [] };
    if (dateStr >= today) return { kind: 'belum-dinilai', label: dateStr === today ? 'Hari ini — belum dinilai' : 'Belum terjadi', logs: [] };
    return { kind: 'absen', label: 'Hari kerja tanpa scan — tidak hadir', logs: [] };
  };

  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    return { d, dateStr, info: dayInfo(dateStr) };
  });

  const tally = cells.reduce((acc, c) => { acc[c.info.kind] = (acc[c.info.kind] || 0) + 1; return acc; }, {} as Record<string, number>);
  const selInfo = selected ? cells.find(c => c.dateStr === selected)?.info : null;

  const fmtTanggal = (s: string) => {
    const [, , dd] = s.split('-');
    return `${Number(dd)} ${NAMA_BULAN[mon - 1]} ${year}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-[var(--color-evergreen)]" /> Kalender Kehadiran
        </h3>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Bulan sebelumnya" disabled={month <= minMonth} onClick={() => shiftMonth(-1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-bold text-[var(--color-evergreen)] w-32 text-center">{NAMA_BULAN[mon - 1]} {year}</span>
          <button type="button" aria-label="Bulan berikutnya" disabled={month >= maxMonth} onClick={() => shiftMonth(1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
        {NAMA_HARI.map(h => <span key={h}>{h}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} className="p-2" />)}
        {cells.map(({ d, dateStr, info }) => {
          const isToday = dateStr === today;
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => setSelected(selected === dateStr ? '' : dateStr)}
              title={`${fmtTanggal(dateStr)} — ${info.label}`}
              className={`p-1.5 rounded-lg text-xs font-mono font-semibold border flex flex-col items-center gap-0.5 cursor-pointer transition-all ${KIND_STYLE[info.kind]} ${selected === dateStr ? 'ring-2 ring-[var(--color-evergreen)]' : isToday ? 'ring-1 ring-blue-400' : ''}`}
            >
              <span>{d}</span>
              {info.masuk && <span className="text-[8px] font-normal leading-none">{info.masuk}{info.pulang ? `–${info.pulang}` : ''}</span>}
              {!info.masuk && info.kind === 'absen' && <span className="text-[8px] font-bold leading-none">✕</span>}
            </button>
          );
        })}
      </div>

      {selInfo && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 text-xs space-y-1">
          <p className="font-black text-gray-800">{fmtTanggal(selected)}</p>
          <p className="text-gray-600">{selInfo.label}</p>
          {selInfo.masuk && <p className="text-gray-600">Masuk <b className="font-mono">{selInfo.masuk}</b>{selInfo.pulang ? <> · Pulang <b className="font-mono">{selInfo.pulang}</b></> : ' · belum scan pulang'}{(selInfo.lateMinutes || 0) > 0 && <> · <span className="text-rose-600 font-bold">telat {selInfo.lateMinutes} mnt</span></>}</p>}
          {showLocation && selInfo.logs.map((l, i) => (
            <p key={i} className="text-[10px] text-gray-400 font-mono">
              {l.type_scan} {l.timestamp.slice(11, 19)} · {l.verification_method === 'admin_qr' ? `dibantu ${l.assisted_by_name || 'admin'}` : 'GPS mandiri'} · {l.latitude?.toFixed(4)}, {l.longitude?.toFixed(4)}
            </p>
          ))}
        </div>
      )}

      <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-bold">
        <Legend swatch="bg-emerald-100 border-emerald-300" text={`Hadir (${tally.hadir || 0})`} />
        <Legend swatch="bg-amber-100 border-amber-300" text={`Ada catatan (${(tally.catatan || 0) + (tally.anomali || 0)})`} />
        <Legend swatch="bg-rose-100 border-rose-300" text={`Tidak hadir (${tally.absen || 0})`} />
        <Legend swatch="bg-slate-50 border-slate-200" text="Libur / belum berlaku" />
        <Legend swatch="bg-gray-50 border-gray-200" text="Belum dinilai" />
      </div>
    </div>
  );
};

const Legend: React.FC<{ swatch: string; text: string }> = ({ swatch, text }) => (
  <span className="flex items-center gap-1 text-gray-600">
    <span className={`w-2.5 h-2.5 rounded border ${swatch}`} />
    <span>{text}</span>
  </span>
);
