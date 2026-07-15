import React, { useEffect, useMemo, useState } from 'react';
import { AttendanceBonusPayout, Employee } from '../types';
import { dataStore, wibNowISO, wibTodayStr } from '../dataStore';
import { Award, CalendarCheck2, CheckCircle2, XCircle, Gift, History, AlertTriangle } from 'lucide-react';

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const monthLabel = (month: string) => {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
};

// Bulan sebelumnya dari 'YYYY-MM'
const previousMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
};

const nextMonthFirstDate = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `1 ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/**
 * Kartu saldo bonus kehadiran bulan berjalan milik satu karyawan.
 * Hijau = masih AMAN, merah = GUGUR beserta alasan dari data absensi.
 */
export const AttendanceBonusBalanceCard: React.FC<{ employee: Employee }> = ({ employee }) => {
  const currentMonth = wibTodayStr().slice(0, 7);
  const result = dataStore.evaluateAttendanceBonus(employee.id, currentMonth);
  const aman = result.status === 'aman';

  return (
    <div className={`rounded-xl border p-4 space-y-1.5 ${aman ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${aman ? 'text-emerald-700' : 'text-rose-700'}`}>
          <Award className="w-4 h-4" /> Saldo Bonus Kehadiran
        </span>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${aman ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {aman ? 'AMAN ✓' : 'GUGUR'}
        </span>
      </div>
      <p className={`text-2xl font-black font-mono ${aman ? 'text-emerald-800' : 'text-rose-400 line-through'}`}>
        {formatIDR(employee.default_attendance_bonus ?? dataStore.getWorkSettings().monthly_bonus_amount)}
      </p>
      {aman ? (
        <p className="text-xs text-emerald-700">
          {monthLabel(currentMonth)} · hadir {result.presentDays}/{result.workingDays} hari kerja, tanpa telat.
          <span className="block text-[11px] text-emerald-600 mt-0.5">Cair: {nextMonthFirstDate(currentMonth)}</span>
        </p>
      ) : (
        <p className="text-xs text-rose-700">
          {result.reasons.join(' · ')}
          <span className="block text-[11px] text-rose-500 mt-0.5">Kesempatan baru mulai bulan depan.</span>
        </p>
      )}
    </div>
  );
};

/** Riwayat slip bonus kehadiran milik satu karyawan (termasuk bulan yang gugur). */
export const AttendanceBonusHistoryList: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const [payouts, setPayouts] = useState<AttendanceBonusPayout[]>([]);

  useEffect(() => {
    const load = () => setPayouts(dataStore.getAttendanceBonusPayouts().filter(p => p.employee_id === employeeId));
    load();
    window.addEventListener('nxty_storage_change', load);
    return () => window.removeEventListener('nxty_storage_change', load);
  }, [employeeId]);

  const sorted = [...payouts].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-6 space-y-4 shadow-3xs">
      <div>
        <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
          <Gift className="w-4 h-4 text-amber-500" /> Riwayat Bonus Kehadiran Anda
        </h3>
        <p className="text-xs text-gray-400">Dinilai otomatis dari data absensi, dibayarkan setiap tanggal 1.</p>
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200">
          Belum ada riwayat bonus kehadiran.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map(p => (
            <div key={p.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border text-xs ${
              p.status === 'cair' ? 'bg-emerald-50/60 border-emerald-100' : 'bg-rose-50/50 border-rose-100'
            }`}>
              <div className="min-w-0">
                <p className="font-bold text-gray-800">{monthLabel(p.month)}</p>
                {p.status === 'cair' ? (
                  <p className="text-[11px] text-emerald-700">Hadir {p.present_days}/{p.working_days} hari · tanpa telat</p>
                ) : (
                  <p className="text-[11px] text-rose-600">{p.reason}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className={`font-mono font-black ${p.status === 'cair' ? 'text-emerald-700' : 'text-rose-400'}`}>
                  {p.status === 'cair' ? formatIDR(p.amount) : 'Rp0'}
                </p>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${p.status === 'cair' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {p.status === 'cair' ? <><CheckCircle2 className="w-3 h-3" /> CAIR</> : <><XCircle className="w-3 h-3" /> GUGUR</>}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Panel admin: rekap bonus kehadiran semua karyawan per bulan (otomatis dari absensi),
 * tombol terbitkan slip tiap tanggal 1, dan riwayat penerbitan.
 */
export const AttendanceBonusPanel: React.FC<{ issuedBy?: string }> = ({ issuedBy }) => {
  const currentMonth = wibTodayStr().slice(0, 7);
  const [month, setMonth] = useState(previousMonth(currentMonth)); // default: bulan yang jatuh tempo dibayar
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payouts, setPayouts] = useState<AttendanceBonusPayout[]>([]);

  const load = () => {
    setEmployees(dataStore.getEmployees().filter(e => e.status_aktif));
    setPayouts(dataStore.getAttendanceBonusPayouts());
  };

  useEffect(() => {
    load();
    window.addEventListener('nxty_storage_change', load);
    return () => window.removeEventListener('nxty_storage_change', load);
  }, []);

  const evaluations = useMemo(() =>
    employees.map(emp => ({ emp, result: dataStore.evaluateAttendanceBonus(emp.id, month) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, month, payouts]
  );

  const alreadyIssued = payouts.some(p => p.month === month);
  const isFutureOrCurrent = month >= currentMonth;
  const totalCair = evaluations.filter(e => e.result.status === 'aman').reduce((sum, e) => sum + e.result.amount, 0);
  const monthOptions = useMemo(() => {
    const options: string[] = [];
    let m = currentMonth;
    for (let i = 0; i < 13; i++) { options.push(m); m = previousMonth(m); }
    return options;
  }, [currentMonth]);

  const handleIssue = () => {
    if (alreadyIssued) return alert(`Slip bonus ${monthLabel(month)} sudah pernah diterbitkan.`);
    if (isFutureOrCurrent && !window.confirm(`Bulan ${monthLabel(month)} belum selesai — penilaian belum final. Tetap terbitkan?`)) return;
    if (!window.confirm(`Terbitkan slip bonus kehadiran ${monthLabel(month)} untuk ${evaluations.length} karyawan?\nTotal cair: ${formatIDR(totalCair)}`)) return;

    const newPayouts: AttendanceBonusPayout[] = evaluations.map(({ emp, result }) => ({
      id: `bonus-${month}-${emp.id}`,
      employee_id: emp.id,
      employee_name: emp.name,
      month,
      amount: result.amount,
      status: result.status === 'aman' ? 'cair' : 'gugur',
      reason: result.reasons.join(' · ') || undefined,
      working_days: result.workingDays,
      present_days: result.presentDays,
      late_minutes_net: result.lateMinutesNet,
      half_days: result.halfDays,
      issued_at: wibNowISO(),
      issued_by: issuedBy,
    }));
    dataStore.setAttendanceBonusPayouts([...newPayouts, ...dataStore.getAttendanceBonusPayouts()]);
    dataStore.logAudit('create', 'attendance_bonus', `Menerbitkan slip bonus kehadiran ${monthLabel(month)}: ${newPayouts.filter(p => p.status === 'cair').length} cair (${formatIDR(totalCair)}), ${newPayouts.filter(p => p.status === 'gugur').length} gugur`);
    load();
    alert(`Slip bonus kehadiran ${monthLabel(month)} berhasil diterbitkan.`);
  };

  // Riwayat penerbitan, dikelompokkan per bulan
  const issuedMonths = useMemo(() => {
    const map = new Map<string, AttendanceBonusPayout[]>();
    payouts.forEach(p => { map.set(p.month, [...(map.get(p.month) || []), p]); });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [payouts]);

  return (
    <div className="space-y-6">
      {/* Header + pemilih bulan */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
              <CalendarCheck2 className="w-4 h-4 text-[var(--color-evergreen)]" /> Bonus Kehadiran Bulanan
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Dinilai 100% dari data absensi — gugur bila ada telat, tidak hadir, atau setengah hari (Minggu tidak dihitung). Dibayarkan setiap tanggal 1.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Bulan Penilaian</span>
              <select
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-evergreen"
              >
                {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </label>
            <button
              onClick={handleIssue}
              disabled={alreadyIssued}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                alreadyIssued
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-[var(--color-evergreen)] text-white hover:bg-opacity-90 cursor-pointer shadow-sm'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              {alreadyIssued ? 'Sudah Diterbitkan' : `Terbitkan Slip ${monthLabel(month)}`}
            </button>
          </div>
        </div>

        {isFutureOrCurrent && (
          <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>Bulan ini masih berjalan — status di bawah adalah posisi sementara dan bisa berubah sampai akhir bulan. Terbitkan slip setiap <b>tanggal 1</b> untuk bulan sebelumnya.</span>
          </div>
        )}

        {/* Tabel evaluasi */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-150 text-gray-400 font-semibold bg-gray-50/50 text-[11px] uppercase tracking-wide">
                <th className="py-2.5 px-3">Karyawan</th>
                <th className="py-2.5 px-3 text-center">Hadir</th>
                <th className="py-2.5 px-3 text-center">Telat (Net)</th>
                <th className="py-2.5 px-3 text-center">½ Hari</th>
                <th className="py-2.5 px-3">Keterangan</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Bonus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {evaluations.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400 italic">Tidak ada karyawan aktif.</td></tr>
              ) : evaluations.map(({ emp, result }) => (
                <tr key={emp.id} className="hover:bg-gray-50/50">
                  <td className="py-2.5 px-3 font-bold text-gray-800">{emp.name}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-gray-600">{result.presentDays}/{result.workingDays}</td>
                  <td className={`py-2.5 px-3 text-center font-mono ${result.lateMinutesNet > 0 ? 'text-rose-600 font-bold' : 'text-gray-500'}`}>
                    {result.lateMinutesNet > 0 ? `${result.lateMinutesNet} mnt` : '—'}
                  </td>
                  <td className={`py-2.5 px-3 text-center font-mono ${result.halfDays > 0 ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>
                    {result.halfDays > 0 ? `${result.halfDays}x` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-gray-500 max-w-[260px]">
                    {result.reasons.length > 0 ? result.reasons.join(' · ') : 'Kehadiran penuh, tanpa telat'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {result.status === 'aman' ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> {isFutureOrCurrent ? 'AMAN' : 'LOLOS'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3" /> GUGUR
                      </span>
                    )}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-mono font-black ${result.status === 'aman' ? 'text-emerald-700' : 'text-rose-300 line-through'}`}>
                    {formatIDR(emp.default_attendance_bonus ?? dataStore.getWorkSettings().monthly_bonus_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            {evaluations.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-emerald-50/40 font-bold">
                  <td colSpan={6} className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wide text-emerald-800">
                    Total akan cair ({evaluations.filter(e => e.result.status === 'aman').length} dari {evaluations.length} karyawan):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-800">{formatIDR(totalCair)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Riwayat penerbitan */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
          <History className="w-4 h-4 text-gray-400" /> Riwayat Penerbitan Bonus
        </h3>
        {issuedMonths.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200">
            Belum ada slip bonus yang diterbitkan.
          </p>
        ) : (
          <div className="space-y-2">
            {issuedMonths.map(([m, list]) => {
              const cair = list.filter(p => p.status === 'cair');
              return (
                <details key={m} className="group bg-gray-50 border border-gray-100 rounded-lg">
                  <summary className="flex items-center justify-between gap-3 p-3 cursor-pointer text-xs select-none">
                    <span className="font-bold text-gray-800">{monthLabel(m)}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-emerald-700 font-semibold">{cair.length} cair</span>
                      <span className="text-rose-500 font-semibold">{list.length - cair.length} gugur</span>
                      <span className="font-mono font-black text-emerald-800">{formatIDR(cair.reduce((s, p) => s + p.amount, 0))}</span>
                    </span>
                  </summary>
                  <div className="px-3 pb-3 space-y-1">
                    {list.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-3 text-[11px] bg-white border border-gray-100 rounded px-2.5 py-1.5">
                        <span className="font-semibold text-gray-700">{p.employee_name}</span>
                        <span className="flex items-center gap-2">
                          {p.status === 'gugur' && <span className="text-rose-500 truncate max-w-[220px]" title={p.reason}>{p.reason}</span>}
                          <span className={`font-mono font-bold ${p.status === 'cair' ? 'text-emerald-700' : 'text-rose-300'}`}>
                            {p.status === 'cair' ? formatIDR(p.amount) : 'Rp0'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
