import React, { useEffect, useMemo, useState } from 'react';
import { AttendanceBonusPayout, Employee, isEligibleForAttendanceBonus, workingDaysInMonth } from '../types';
import { dataStore, wibNowISO, wibTodayStr } from '../dataStore';
import { DivisionFilter } from './DivisionFilter';
import { Award, CalendarCheck2, CheckCircle2, XCircle, Gift, History, AlertTriangle } from 'lucide-react';

/** Tanggal hari ini dalam bahasa Indonesia, mis. "27 Juli 2026". */
const todayLabel = () => new Date(`${wibTodayStr()}T00:00:00`).toLocaleDateString('id-ID', {
  day: 'numeric', month: 'long', year: 'numeric',
});

/** Nilai bonus yang dipertaruhkan karyawan ini bulan ini (dipakai saat statusnya gugur). */
const bonusOf = (employee: Employee) =>
  employee.default_attendance_bonus ?? dataStore.getWorkSettings().monthly_bonus_amount;

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
  // Saldo = akumulasi hari layak x tarif harian; hari telat hanya kehilangan hari itu
  const accrued = result.amount;
  const totalWorkingDays = workingDaysInMonth(currentMonth, dataStore.getWorkSettings().attendance_effective_from);

  return (
    <div className={`rounded-xl border p-4 space-y-1.5 ${aman ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${aman ? 'text-emerald-700' : 'text-rose-700'}`}>
          <Award className="w-4 h-4" /> Saldo Bonus Kehadiran
        </span>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${aman ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
          {result.qualifiedDays}/{result.workingDays} HARI
        </span>
      </div>
      <p className={`text-2xl font-black font-mono ${aman ? 'text-emerald-800' : 'text-rose-400'}`}>
        {formatIDR(accrued)}
      </p>
      <p className={`text-xs ${accrued > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
        {result.qualifiedDays} hari layak x {formatIDR(result.dailyRate)} · {monthLabel(currentMonth)}
        {result.reasons.length > 0 && (
          <span className="block text-[11px] text-rose-600 mt-0.5">{result.reasons.join(' · ')}</span>
        )}
        <span className="block text-[11px] text-gray-500 mt-0.5">
          {isEligibleForAttendanceBonus(employee)
            ? <>Terus bertambah tiap hari masuk tanpa telat. Cair: {nextMonthFirstDate(currentMonth)}</>
            : 'Bonus mulai berlaku setelah status berubah menjadi Karyawan.'}
        </span>
      </p>
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
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 shadow-xs">
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
  // Sortir: cari nama karyawan dan batasi per divisi
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState('');

  const load = () => {
    setEmployees(dataStore.getEmployees().filter(e => e.status_aktif));
    setPayouts(dataStore.getAttendanceBonusPayouts());
  };

  useEffect(() => {
    load();
    window.addEventListener('nxty_storage_change', load);
    return () => window.removeEventListener('nxty_storage_change', load);
  }, []);

  // Satu sumber penyaringan untuk tabel bulan penilaian maupun tabel posisi hari ini,
  // supaya angka di keduanya selalu bicara tentang orang yang sama.
  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(emp =>
      (!divFilter || emp.department_id === divFilter) &&
      (!q || `${emp.name} ${emp.username || ''}`.toLowerCase().includes(q))
    );
  }, [employees, search, divFilter]);

  const evaluations = useMemo(() =>
    [...filteredEmployees].sort((a, b) => a.name.localeCompare(b.name, 'id'))
      .map(emp => ({ emp, result: dataStore.evaluateAttendanceBonus(emp.id, month) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredEmployees, month, payouts]
  );

  // Penerbitan slip WAJIB memakai seluruh karyawan aktif, bukan hasil sortir tampilan.
  // Kalau ikut filter, slip hanya terbit untuk yang kebetulan terlihat di layar.
  const issuableEvaluations = useMemo(() =>
    [...employees].sort((a, b) => a.name.localeCompare(b.name, 'id'))
      .map(emp => ({ emp, result: dataStore.evaluateAttendanceBonus(emp.id, month) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, month, payouts]
  );

  // Rekap bonus BERJALAN (bulan ini) — selalu tampil, tanpa perlu ganti pilihan bulan.
  // Angkanya posisi sementara: hari ini & sisa bulan belum dinilai.
  const running = useMemo(() => {
    // Hari kerja yang sudah dinilai hanya sampai kemarin, jadi sisanya termasuk hari ini
    const totalWorkingDays = workingDaysInMonth(currentMonth, dataStore.getWorkSettings().attendance_effective_from);
    // Saldo berjalan = akumulasi bonus harian yang sudah diperoleh; hari yang telat
    // atau absen hanya kehilangan hari itu, saldo sebelumnya tidak hangus.
    const rows = filteredEmployees
      .map(emp => {
        const result = dataStore.evaluateAttendanceBonus(emp.id, currentMonth);
        return { emp, result, accrued: result.amount };
      })
      .sort((a, b) => a.emp.name.localeCompare(b.emp.name, 'id'));
    const aman = rows.filter(r => r.result.status === 'aman');
    const assessedDays = rows[0]?.result.workingDays ?? 0;
    // Diagnosa "kenapa saldonya nol", supaya tidak perlu menebak:
    // (a) karyawan yang nilai bonusnya belum diatur, (b) hari kerja yang tidak punya
    // absensi sama sekali — tanda absensi belum dipakai pada hari-hari itu.
    const zeroBonus = rows.filter(r => bonusOf(r.emp) <= 0).length;
    const effectiveFrom = dataStore.getWorkSettings().attendance_effective_from;
    const scannedDates = new Set(
      dataStore.getAttendance()
        .filter(a => a.timestamp.startsWith(currentMonth))
        .map(a => a.timestamp.slice(0, 10))
    );
    let emptyDays = 0;
    for (let d = 1; d <= 31; d++) {
      const dateStr = `${currentMonth}-${String(d).padStart(2, '0')}`;
      if (!dateStr.startsWith(currentMonth) || dateStr.slice(8) > '31') break;
      if (new Date(`${dateStr}T00:00:00Z`).getUTCDay() === 0) continue;
      if (dateStr >= wibTodayStr()) continue;
      if (effectiveFrom && dateStr < effectiveFrom) continue;
      if (!scannedDates.has(dateStr)) emptyDays++;
    }
    return {
      rows,
      amanCount: aman.length,
      // Saldo berjalan seluruh karyawan sampai kemarin
      accruedTotal: rows.reduce((sum, r) => sum + r.accrued, 0),
      // Potensi bila semua hari kerja bulan ini layak
      total: rows.reduce((sum, r) => sum + r.result.potentialAmount, 0),
      employeeCount: rows.length,
      totalWorkingDays,
      assessedDays,
      remainingDays: Math.max(0, totalWorkingDays - assessedDays),
      zeroBonus,
      emptyDays,
      effectiveFrom,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEmployees, currentMonth, payouts]);

  const alreadyIssued = payouts.some(p => p.month === month);
  const isFutureOrCurrent = month >= currentMonth;
  const totalCair = issuableEvaluations.reduce((sum, e) => sum + e.result.amount, 0);
  const monthOptions = useMemo(() => {
    const options: string[] = [];
    let m = currentMonth;
    for (let i = 0; i < 13; i++) { options.push(m); m = previousMonth(m); }
    return options;
  }, [currentMonth]);

  const handleIssue = () => {
    if (alreadyIssued) return alert(`Slip bonus ${monthLabel(month)} sudah pernah diterbitkan.`);
    if (isFutureOrCurrent && !window.confirm(`Bulan ${monthLabel(month)} belum selesai — penilaian belum final. Tetap terbitkan?`)) return;
    if (!window.confirm(`Terbitkan slip bonus kehadiran ${monthLabel(month)} untuk ${issuableEvaluations.length} karyawan aktif?\nTotal cair: ${formatIDR(totalCair)}`)) return;

    const newPayouts: AttendanceBonusPayout[] = issuableEvaluations.map(({ emp, result }) => ({
      id: `bonus-${month}-${emp.id}`,
      employee_id: emp.id,
      employee_name: emp.name,
      month,
      amount: result.amount,
      status: result.amount > 0 ? 'cair' : 'gugur',
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
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
              <CalendarCheck2 className="w-4 h-4 text-[var(--color-evergreen)]" /> Bonus Kehadiran Bulanan
            </h3>
            <p className="text-xs text-gray-800 mt-0.5 leading-relaxed">
              Hanya untuk yang berstatus <b>Karyawan</b>; yang masih training tetap dinilai tapi belum berhak cair.
              Dinilai 100% dari data absensi: <b>tiap hari</b> masuk tanpa telat dan scan pulang pada/setelah jam
              pulang menambah tarif harian ke saldo. Hari yang telat, tidak hadir, atau setengah hari hanya
              kehilangan hari itu — saldo yang sudah terkumpul tidak hangus. Minggu tidak dihitung hari kerja.
              Dibayarkan setiap tanggal 1.
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
                {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}{m === currentMonth ? ' (Berjalan)' : ''}</option>)}
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

        {/* Sortir karyawan & divisi — berlaku untuk tabel posisi hari ini maupun tabel bulan */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 border-t border-gray-100 pt-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama karyawan..."
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs w-full sm:w-56 focus:outline-none focus:ring-1 focus:ring-evergreen"
          />
          <DivisionFilter value={divFilter} onChange={setDivFilter} />
          <span className="text-[10px] text-gray-400 sm:ml-auto">
            {evaluations.length} dari {employees.length} karyawan aktif
          </span>
        </div>

        <button
          onClick={() => setMonth(currentMonth)}
          className="w-full flex flex-wrap items-center justify-between gap-2 text-left bg-emerald-50/60 border border-emerald-100 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-emerald-50"
        >
          <span className="text-[11px] text-emerald-800">
            <b className="uppercase tracking-wide">Saldo bonus berjalan {monthLabel(currentMonth)}</b>
            <span className="block text-emerald-600 mt-0.5">
              {running.amanCount} dari {running.employeeCount} karyawan tanpa catatan ·
              {' '}{running.assessedDays} dari {running.totalWorkingDays} hari kerja terlewati ·
              {' '}sisa {running.remainingDays} hari lagi
            </span>
          </span>
          <span className="text-right">
            <span className="block font-mono font-black text-emerald-800 text-lg">{formatIDR(running.accruedTotal)}</span>
            <span className="block text-[10px] text-emerald-600">
              potensi bulan ini {formatIDR(running.total)}
            </span>
          </span>
        </button>

        {/* Posisi hari ini per karyawan — supaya tidak perlu menunggu awal bulan.
            Angka bonus di sini bukan uang yang sudah pasti: satu telat atau absen
            menggugurkan bonus sebulan penuh, jadi baris bisa berubah kapan saja. */}
        <details open className="border border-gray-200 rounded-lg overflow-hidden">
          <summary className="cursor-pointer select-none bg-gray-50 px-3 py-2 text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
            <CalendarCheck2 className="w-3.5 h-3.5 text-[var(--color-evergreen)]" />
            Posisi hari ini · {todayLabel()}
            <span className="font-normal text-gray-400">
              ({running.amanCount}/{running.employeeCount} aman · sisa {running.remainingDays} hari kerja)
            </span>
          </summary>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-evergreen/90 text-white font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2 px-3">Karyawan</th>
                  <th className="py-2 px-3 text-center w-24">Hadir</th>
                  <th className="py-2 px-3 text-center w-24">Hari Layak</th>
                  <th className="py-2 px-3 text-center w-24">Telat</th>
                  <th className="py-2 px-3 text-right w-32">Saldo Berjalan</th>
                  <th className="py-2 px-3 text-right w-28">Potensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {running.rows.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-gray-400 italic">
                    {employees.length === 0 ? 'Tidak ada karyawan aktif.' : 'Tidak ada karyawan yang cocok dengan pencarian / divisi.'}
                  </td></tr>
                ) : running.rows.map(({ emp, result, accrued }) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50">
                    <td className="py-2 px-3 font-bold text-gray-800">
                      {emp.name}
                      {!isEligibleForAttendanceBonus(emp) && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[9px] font-bold uppercase align-middle">
                          Training
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-gray-600">{result.presentDays}/{result.workingDays}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700" title={result.reasons.join(' · ') || 'Semua hari kerja layak'}>
                      {result.qualifiedDays}
                      <span className="text-gray-400 font-normal">/{result.workingDays}</span>
                    </td>
                    <td className={`py-2 px-3 text-center font-mono ${result.lateDates.length > 0 ? 'text-rose-600 font-bold' : 'text-gray-400'}`}>
                      {result.lateDates.length > 0 ? `${result.lateDates.length} hari` : '—'}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono font-black ${accrued > 0 ? 'text-emerald-700' : 'text-rose-400'}`}>
                      {formatIDR(accrued)}
                      <span className="block text-[9px] font-normal text-gray-400">
                        {result.qualifiedDays}x {formatIDR(result.dailyRate)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-gray-500">{formatIDR(result.potentialAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="px-3 py-2 text-[10px] text-gray-400 bg-gray-50/70 border-t border-gray-100">
            <b>Saldo Berjalan</b> = jumlah hari layak × tarif harian, terkumpul sampai kemarin
            ({running.assessedDays}/{running.totalWorkingDays} hari kerja). Satu hari layak bila masuk
            tanpa telat dan scan pulang pada/setelah jam pulang. Hari yang telat atau tidak hadir hanya
            kehilangan hari itu — saldo yang sudah terkumpul tidak hangus.
            <b> Potensi</b> = bila seluruh hari kerja bulan ini layak.
          </p>
        </details>

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
              <tr className="bg-evergreen text-white font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Karyawan</th>
                <th className="py-2.5 px-3 text-center">Hadir</th>
                <th className="py-2.5 px-3 text-center">Telat (Net)</th>
                <th className="py-2.5 px-3 text-center">½ Hari</th>
                <th className="py-2.5 px-3">Keterangan</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Bonus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-200">
              {evaluations.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400 italic">
                  {employees.length === 0 ? 'Tidak ada karyawan aktif.' : 'Tidak ada karyawan yang cocok dengan pencarian / divisi.'}
                </td></tr>
              ) : evaluations.map(({ emp, result }) => (
                <tr key={emp.id} className="hover:bg-gray-50/50">
                  <td className="py-2.5 px-3 font-bold text-gray-800">
                    {emp.name}
                    {!isEligibleForAttendanceBonus(emp) && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[9px] font-bold uppercase align-middle">
                        Training
                      </span>
                    )}
                  </td>
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
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
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
                      <div key={p.id} className="flex items-center justify-between gap-3 text-[11px] bg-white border border-gray-200 rounded px-2.5 py-1.5">
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
