import React, { useEffect, useMemo, useState } from 'react';
import { Attendance, AttendanceBonusPayout, bonusHariLayakTarif, Employee, isEligibleForAttendanceBonus, workingDaysInMonth, divisionLabel } from '../types';
import { dataStore, wibNowISO, wibTodayStr } from '../dataStore';
import { exportExcel } from '../exportExcel';
import { withA4PageSize } from '../printA4';
import { A4PreviewSheet } from './A4PreviewSheet';
import { renderBonusSlipLayout } from '../bonusSlip';
import { DivisionFilter } from './DivisionFilter';
import { AttendanceCalendar } from './AttendanceCalendar';
import { Award, CalendarCheck2, CheckCircle2, XCircle, Gift, History, AlertTriangle, FileSpreadsheet, Printer, ChevronDown, Trash2 } from 'lucide-react';

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
  // Hijau = tidak ada hari hilang. Kuning = ada yang hilang tapi saldo tetap tumbuh.
  // Merah hanya bila benar-benar nol — bonus ini akumulasi harian, bukan hangus sebulan.
  const hariHilang = result.workingDays - result.qualifiedDays;
  const nada = result.amount <= 0 ? 'merah' : hariHilang > 0 ? 'kuning' : 'hijau';
  // Saldo = akumulasi hari layak x tarif harian; hari telat hanya kehilangan hari itu
  const accrued = result.amount;
  const totalWorkingDays = workingDaysInMonth(currentMonth, dataStore.getWorkSettings().attendance_effective_from);

  return (
    <div className={`rounded-xl border p-4 space-y-1.5 ${nada === 'hijau' ? 'bg-emerald-50 border-emerald-200' : nada === 'kuning' ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${nada === 'hijau' ? 'text-emerald-700' : nada === 'kuning' ? 'text-amber-700' : 'text-rose-700'}`}>
          <Award className="w-4 h-4" /> Saldo Bonus Kehadiran
        </span>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${nada === 'hijau' ? 'bg-emerald-600 text-white' : nada === 'kuning' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}>
          {result.qualifiedDays}/{result.workingDays} HARI
        </span>
      </div>
      <p className={`text-2xl font-black font-mono ${nada === 'merah' ? 'text-rose-400' : 'text-emerald-800'}`}>
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

/** Ringkasan hari & jam dari satu slip bonus, dari angka yang sudah tersimpan di slip. */
const bonusRincian = (p: AttendanceBonusPayout): string => {
  const bagian = [`Hadir ${p.present_days}/${p.working_days} hari`];
  if (p.late_minutes_net > 0) bagian.push(`telat total ${p.late_minutes_net} mnt`);
  if (p.half_days > 0) bagian.push(`setengah hari ${p.half_days}×`);
  if (p.status === 'cair' && p.late_minutes_net === 0 && p.half_days === 0) bagian.push('tanpa telat');
  return bagian.join(' · ');
};

/** Riwayat slip bonus kehadiran milik satu karyawan (termasuk bulan yang gugur). */
export const AttendanceBonusHistoryList: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const [payouts, setPayouts] = useState<AttendanceBonusPayout[]>([]);
  const [logs, setLogs] = useState<Attendance[]>([]);
  const [openMonth, setOpenMonth] = useState('');
  const [previewPayout, setPreviewPayout] = useState<AttendanceBonusPayout | null>(null);
  const [printPayout, setPrintPayout] = useState<AttendanceBonusPayout | null>(null);

  useEffect(() => {
    const load = () => {
      setPayouts(dataStore.getAttendanceBonusPayouts().filter(p => p.employee_id === employeeId));
      setLogs(dataStore.getAttendance().filter(a => a.employee_id === employeeId));
    };
    load();
    window.addEventListener('nxty_storage_change', load);
    return () => window.removeEventListener('nxty_storage_change', load);
  }, [employeeId]);

  const employee = dataStore.getEmployees().find(e => e.id === employeeId);
  const joinDate = employee?.join_date;
  const deptLabel = divisionLabel(employee?.department_id, 'Umum');
  const sorted = [...payouts].sort((a, b) => b.month.localeCompare(a.month));

  const cetakSlip = (p: AttendanceBonusPayout) => {
    setPrintPayout(p);
    setTimeout(() => withA4PageSize(() => window.print()), 150);
  };

  return (
    <>
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 shadow-xs no-print">
      <div>
        <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
          <Gift className="w-4 h-4 text-amber-500" /> Riwayat Bonus Kehadiran Anda
        </h3>
        <p className="text-xs text-gray-400">Dinilai otomatis dari data absensi, dibayarkan setiap tanggal 1. Klik bulan untuk lihat kalender jam kehadirannya.</p>
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200">
          Belum ada riwayat bonus kehadiran.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map(p => {
            const open = openMonth === p.month;
            return (
              <div key={p.id} className={`rounded-lg border text-xs ${
                p.status === 'cair' ? 'bg-emerald-50/60 border-emerald-100' : 'bg-rose-50/50 border-rose-100'
              }`}>
                <button
                  type="button"
                  onClick={() => setOpenMonth(open ? '' : p.month)}
                  className="w-full flex items-center justify-between gap-3 p-3 text-left cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 flex items-center gap-1">
                      {monthLabel(p.month)}
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </p>
                    <p className={`text-[11px] ${p.status === 'cair' ? 'text-emerald-700' : 'text-gray-600'}`}>{bonusRincian(p)}</p>
                    {p.status === 'gugur' && p.reason && (
                      <p className="text-[11px] text-rose-600 mt-0.5">{p.reason}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-mono font-black ${p.status === 'cair' ? 'text-emerald-700' : 'text-rose-400'}`}>
                      {p.status === 'cair' ? formatIDR(p.amount) : 'Rp0'}
                    </p>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${p.status === 'cair' ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {p.status === 'cair' ? <><CheckCircle2 className="w-3 h-3" /> CAIR</> : <><XCircle className="w-3 h-3" /> GUGUR</>}
                    </span>
                    {p.status === 'cair' && (
                      <span className={`block mt-0.5 text-[9px] font-bold ${p.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {p.payment_status === 'paid' ? '✓ Sudah dibayar' : 'Belum dibayar'}
                      </span>
                    )}
                  </div>
                </button>
                {p.status === 'cair' && (
                  <div className="px-3 pb-3 -mt-1">
                    <button
                      type="button"
                      onClick={() => setPreviewPayout(p)}
                      className="bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Printer className="w-3 h-3" /> Lihat / Cetak Slip Bonus
                    </button>
                  </div>
                )}
                {open && (
                  <div className="border-t border-gray-200/70 p-3">
                    <AttendanceCalendar logs={logs} joinDate={joinDate} initialMonth={p.month} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>

    {previewPayout && (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto overscroll-contain no-print font-sans">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col my-auto max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)]">
          <div className="bg-slate-50 border-b border-slate-100 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
              <span className="font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-wider">Pratinjau Slip Bonus (A4)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewPayout(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => cetakSlip(previewPayout)}
                className="bg-emerald-800 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-900 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Sekarang
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-6 bg-slate-200 min-h-0 flex-1 overflow-auto overscroll-contain">
            <A4PreviewSheet>
              {renderBonusSlipLayout(previewPayout, deptLabel)}
            </A4PreviewSheet>
          </div>
          <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2">
            <span>● Slip dicetak pada kertas A4 biasa atau disimpan sebagai PDF.</span>
            <span className="font-semibold text-slate-700">Pilih &quot;Save as PDF&quot; di dialog cetak bila ingin disimpan.</span>
          </div>
        </div>
      </div>
    )}

    {printPayout && (
      <div className="print-only" style={{ width: '180mm', boxSizing: 'border-box' }}>
        {renderBonusSlipLayout(printPayout, deptLabel)}
      </div>
    )}
    </>
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
  const [view, setView] = useState<'posisi' | 'evaluasi' | 'slip'>('posisi');
  const [riwayatDivFilter, setRiwayatDivFilter] = useState('');
  // Buku slip bonus: pisah yang belum dibayar dari arsip lunas (sama seperti gaji mingguan)
  const [slipListView, setSlipListView] = useState<'aktif' | 'arsip'>('aktif');
  const [printPayout, setPrintPayout] = useState<AttendanceBonusPayout | null>(null);
  // Buku slip mengikuti format Daftar Slip Gaji: tabel datar + sortir header + paginasi.
  const [previewPayout, setPreviewPayout] = useState<AttendanceBonusPayout | null>(null);
  const [slipPage, setSlipPage] = useState(1);
  const [slipSort, setSlipSort] = useState<{ key: 'name' | 'month' | 'days' | 'amount'; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [deletePayoutId, setDeletePayoutId] = useState('');

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
    const tanpaCatatan = rows.filter(r => r.result.reasons.length === 0 && r.result.workingDays > 0);
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
      amanCount: tanpaCatatan.length,
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
      qualified_days: result.qualifiedDays,
      daily_rate: result.dailyRate,
      issued_at: wibNowISO(),
      issued_by: issuedBy,
      payment_status: 'unpaid',
    }));
    dataStore.setAttendanceBonusPayouts([...newPayouts, ...dataStore.getAttendanceBonusPayouts()]);
    dataStore.logAudit('create', 'attendance_bonus', `Menerbitkan slip bonus kehadiran ${monthLabel(month)}: ${newPayouts.filter(p => p.status === 'cair').length} cair (${formatIDR(totalCair)}), ${newPayouts.filter(p => p.status === 'gugur').length} gugur`);
    load();
    alert(`Slip bonus kehadiran ${monthLabel(month)} berhasil diterbitkan.`);
  };

  const handleTogglePaid = (p: AttendanceBonusPayout) => {
    dataStore.setAttendanceBonusPaymentStatus(p.id, p.payment_status === 'paid' ? 'unpaid' : 'paid');
    load();
  };

  const handlePrintBonusSlip = (p: AttendanceBonusPayout) => {
    // Cetak lewat pratinjau dulu (seperti slip gaji mingguan) — admin bisa
    // memeriksa dokumen sebelum kertas keluar.
    setPreviewPayout(p);
  };

  const triggerPrintBonusSlip = (p: AttendanceBonusPayout) => {
    setPrintPayout(p);
    setTimeout(() => withA4PageSize(() => window.print()), 150);
  };

  // Hapus per-slip menggantikan "batalkan seluruh bulan".
  const confirmDeletePayout = () => {
    if (!deletePayoutId) return;
    dataStore.setAttendanceBonusPayouts(dataStore.getAttendanceBonusPayouts().filter(p => p.id !== deletePayoutId));
    dataStore.logAudit('delete', 'attendance_bonus', `Menghapus slip bonus kehadiran ${deletePayoutId.replace(/^bonus-/, '')}`);
    setDeletePayoutId('');
    load();
  };

  const employeeDept = useMemo(() => new Map(employees.map(e => [e.id, e.department_id])), [employees]);
  // Semua karyawan (bukan cuma aktif) — slip lama milik karyawan nonaktif tetap
  // bisa menampilkan tarif fallback dari settingnya.
  const employeeById = useMemo(() => new Map(dataStore.getEmployees().map(e => [e.id, e])), [employees]);

  // Slip bonus yang sudah diterbitkan, disaring per divisi, dikelompokkan per bulan.
  // Pencarian nama di atas berlaku untuk ketiga tabel: posisi, evaluasi, DAN buku slip.
  const filteredPayouts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payouts.filter(p =>
      (!riwayatDivFilter || employeeDept.get(p.employee_id) === riwayatDivFilter) &&
      (!q || p.employee_name.toLowerCase().includes(q)));
  }, [payouts, riwayatDivFilter, search, employeeDept]);

  // Ringkasan seluruh slip (bukan cuma yang ditampilkan) — kartu di atas.
  const slipTotals = useMemo(() => {
    const cair = filteredPayouts.filter(p => p.status === 'cair');
    return {
      cairTotal: cair.reduce((s, p) => s + p.amount, 0),
      paidTotal: cair.filter(p => p.payment_status === 'paid').reduce((s, p) => s + p.amount, 0),
      unpaidTotal: cair.filter(p => p.payment_status !== 'paid').reduce((s, p) => s + p.amount, 0),
      unpaidCount: cair.filter(p => p.payment_status !== 'paid').length,
      paidCount: cair.filter(p => p.payment_status === 'paid').length,
      gugurCount: filteredPayouts.filter(p => p.status === 'gugur').length,
    };
  }, [filteredPayouts]);

  // Belum Dibayar = slip cair yang payment_status != paid. Arsip Lunas = yang paid.
  // Slip gugur ikut di daftar aktif sebagai baris Rp0 + alasan, supaya pertanyaan
  // "kenapa dia tidak dapat bonus" terjawab langsung dari tabel.
  const slipSortValue = (p: AttendanceBonusPayout): string | number =>
    slipSort.key === 'name' ? p.employee_name
    : slipSort.key === 'month' ? p.month
    : slipSort.key === 'days' ? p.present_days
    : p.amount;
  const toggleSlipSort = (key: typeof slipSort.key) =>
    setSlipSort(prev => (prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  const flatSlips = useMemo(() => filteredPayouts
    .filter(p => p.status === 'gugur'
      ? slipListView === 'aktif'
      : slipListView === 'arsip' ? p.payment_status === 'paid' : p.payment_status !== 'paid')
    .sort((a, b) => {
      const va = slipSortValue(a);
      const vb = slipSortValue(b);
      const cmp = typeof va === 'string' || typeof vb === 'string'
        ? String(va).localeCompare(String(vb))
        : va - vb;
      return slipSort.dir === 'asc' ? cmp : -cmp;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredPayouts, slipListView, slipSort]);
  const SLIP_PAGE_SIZE = 20;
  const slipTotalPages = Math.max(1, Math.ceil(flatSlips.length / SLIP_PAGE_SIZE));
  const slipPageClamped = Math.min(slipPage, slipTotalPages);
  const pagedSlips = flatSlips.slice((slipPageClamped - 1) * SLIP_PAGE_SIZE, slipPageClamped * SLIP_PAGE_SIZE);

  const handleExportBonusExcel = () => {
    const rows = [...filteredPayouts]
      .sort((a, b) => b.month.localeCompare(a.month) || a.employee_name.localeCompare(b.employee_name))
      .map(p => ({
        Bulan: monthLabel(p.month),
        Nama: p.employee_name,
        Divisi: divisionLabel(employeeDept.get(p.employee_id), 'Umum'),
        Status: p.status === 'cair' ? 'Cair' : 'Gugur',
        'Hari Hadir': p.present_days,
        'Hari Kerja': p.working_days,
        'Telat (menit)': p.late_minutes_net,
        'Setengah Hari': p.half_days,
        Jumlah: p.amount,
        'Status Bayar': p.status !== 'cair' ? '-' : p.payment_status === 'paid' ? 'Lunas' : 'Belum Dibayar',
        'Tanggal Bayar': p.paid_at?.slice(0, 10) || '',
        Alasan: p.reason || '',
      }));
    void exportExcel(`Rekap_Bonus_Kehadiran_${wibTodayStr()}`, [{
      name: 'Bonus Kehadiran', rows, currencyColumns: ['Jumlah'],
    }]);
  };

  return (
    <>
    <div className="space-y-6 no-print">
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
          <div className="flex flex-wrap items-end gap-2">
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

        {/* Filter divisi — berlaku untuk tabel posisi hari ini maupun tabel bulan */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 border-t border-gray-100 pt-3">
          <DivisionFilter value={divFilter} onChange={setDivFilter} />
        </div>

        {/* Sub-tab: pisah 3 tabel supaya tidak scroll panjang */}
        <div className="flex gap-1 border-b border-gray-100 -mb-4 pb-0">
          {([
            ['posisi', `Posisi Hari Ini`, 'bg-sky-50 text-sky-800 border-sky-100', 'bg-sky-50/50 text-sky-700/70'],
            ['evaluasi', `Evaluasi ${monthLabel(month)}`, 'bg-emerald-50 text-emerald-800 border-emerald-100', 'bg-emerald-50/50 text-emerald-700/70'],
            ['slip', `Buku Slip Bonus${slipTotals.unpaidCount > 0 ? ` (${slipTotals.unpaidCount})` : ''}`, 'bg-amber-50 text-amber-800 border-amber-100', 'bg-amber-50/50 text-amber-700/70'],
          ] as const).map(([key, label, activeColor, inactiveColor]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg cursor-pointer border border-b-0 ${
                view === key ? activeColor : `${inactiveColor} border-transparent hover:brightness-95`
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'posisi' && (
      <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-5 shadow-xs space-y-4">
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
            Angkanya saldo berjalan: tiap hari layak menambah, hari yang hilang hanya
            mengurangi hari itu. Masih bisa bertambah sampai akhir bulan. */}
        <details open className="border border-gray-200 rounded-lg overflow-hidden">
          <summary className="cursor-pointer select-none bg-gray-50 px-3 py-2 text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
            <CalendarCheck2 className="w-3.5 h-3.5 text-[var(--color-evergreen)]" />
            Posisi hari ini · {todayLabel()}
            <span className="font-normal text-gray-400">
              ({running.amanCount}/{running.employeeCount} tanpa hari hilang · sisa {running.remainingDays} hari kerja)
            </span>
          </summary>

          <div className="px-3 py-2 bg-gray-50/70 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama karyawan..."
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-full sm:w-56 focus:outline-none focus:ring-1 focus:ring-evergreen"
            />
            <span className="text-[10px] text-gray-400 sm:ml-auto">
              {running.rows.length} dari {running.employeeCount} karyawan
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] md:text-xs">
              <thead>
                <tr className="bg-evergreen/90 text-white font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2 px-2 md:px-3">Karyawan</th>
                  {/* Di HP kolom Hadir & Potensi disembunyikan: potensi sudah tampil di kartu saldo di atas */}
                  <th className="hidden md:table-cell py-2 px-3 text-center w-24">Hadir</th>
                  <th className="py-2 px-2 md:px-3 text-center w-14 md:w-24">Hari Layak</th>
                  <th className="py-2 px-2 md:px-3 text-center w-14 md:w-24">Telat</th>
                  <th className="py-2 px-2 md:px-3 text-right w-24 md:w-32">Saldo Berjalan</th>
                  <th className="hidden md:table-cell py-2 px-3 text-right w-28">Potensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {running.rows.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-gray-400 italic">
                    {employees.length === 0 ? 'Tidak ada karyawan aktif.' : 'Tidak ada karyawan yang cocok dengan pencarian / divisi.'}
                  </td></tr>
                ) : running.rows.map(({ emp, result, accrued }) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50">
                    <td className="py-2 px-2 md:px-3 font-bold text-gray-800">
                      {emp.name}
                      {!isEligibleForAttendanceBonus(emp) && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[9px] font-bold uppercase align-middle">
                          Training
                        </span>
                      )}
                    </td>
                    <td className="hidden md:table-cell py-2 px-3 text-center font-mono text-gray-600">{result.presentDays}/{result.workingDays}</td>
                    <td className="py-2 px-2 md:px-3 text-center font-mono font-bold text-emerald-700" title={result.reasons.join(' · ') || 'Semua hari kerja layak'}>
                      {result.qualifiedDays}
                      <span className="text-gray-400 font-normal">/{result.workingDays}</span>
                    </td>
                    <td className={`py-2 px-2 md:px-3 text-center font-mono ${result.lateDates.length > 0 ? 'text-rose-600 font-bold' : 'text-gray-400'}`}>
                      {result.lateDates.length > 0 ? `${result.lateDates.length} hari` : '—'}
                    </td>
                    <td className={`py-2 px-2 md:px-3 text-right font-mono font-black ${accrued > 0 ? 'text-emerald-700' : 'text-rose-400'}`}>
                      {formatIDR(accrued)}
                      <span className="block text-[9px] font-normal text-gray-400">
                        {result.qualifiedDays}x {formatIDR(result.dailyRate)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell py-2 px-3 text-right font-mono text-gray-500">{formatIDR(result.potentialAmount)}</td>
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
      </div>
      )}

      {view === 'evaluasi' && (
      <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-5 shadow-xs space-y-4">
        {isFutureOrCurrent && (
          <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>Bulan ini masih berjalan — status di bawah adalah posisi sementara dan bisa berubah sampai akhir bulan. Terbitkan slip setiap <b>tanggal 1</b> untuk bulan sebelumnya.</span>
          </div>
        )}

        {/* Pencarian dekat tabel: menyaring tabel evaluasi bulan terpilih */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama karyawan..."
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-full sm:w-56 focus:outline-none focus:ring-1 focus:ring-evergreen"
          />
          <span className="text-[10px] text-gray-400 sm:ml-auto">
            {evaluations.length} dari {employees.length} karyawan
          </span>
        </div>

        {/* Tabel evaluasi */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[10px] md:text-xs">
            <thead>
              <tr className="bg-evergreen text-white font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-1 md:px-3">Karyawan</th>
                {/* Di HP kolom Hadir/Telat/½ Hari disembunyikan — rinciannya tetap terbaca di Keterangan */}
                <th className="hidden md:table-cell py-2.5 px-3 text-center">Hadir</th>
                <th className="hidden md:table-cell py-2.5 px-3 text-center">Telat (Net)</th>
                <th className="hidden md:table-cell py-2.5 px-3 text-center">½ Hari</th>
                <th className="py-2.5 px-1 md:px-3">Keterangan</th>
                <th className="py-2.5 px-1 md:px-3 text-center">Hari Layak</th>
                <th className="py-2.5 px-1 md:px-3 text-right">Bonus Terkumpul</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-200">
              {evaluations.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400 italic">
                  {employees.length === 0 ? 'Tidak ada karyawan aktif.' : 'Tidak ada karyawan yang cocok dengan pencarian / divisi.'}
                </td></tr>
              ) : evaluations.map(({ emp, result }) => (
                <tr key={emp.id} className="hover:bg-gray-50/50">
                  <td className="py-2.5 px-1 md:px-3 font-bold text-gray-800">
                    {emp.name}
                    {!isEligibleForAttendanceBonus(emp) && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[9px] font-bold uppercase align-middle">
                        Training
                      </span>
                    )}
                  </td>
                  <td className="hidden md:table-cell py-2.5 px-3 text-center font-mono text-gray-600">{result.presentDays}/{result.workingDays}</td>
                  <td className={`hidden md:table-cell py-2.5 px-3 text-center font-mono ${result.lateMinutesNet > 0 ? 'text-rose-600 font-bold' : 'text-gray-500'}`}>
                    {result.lateMinutesNet > 0 ? `${result.lateMinutesNet} mnt` : '—'}
                  </td>
                  <td className={`hidden md:table-cell py-2.5 px-3 text-center font-mono ${result.halfDays > 0 ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>
                    {result.halfDays > 0 ? `${result.halfDays}x` : '—'}
                  </td>
                  <td className="py-2.5 px-1 md:px-3 text-[11px] text-gray-500 md:max-w-[260px]">
                    {result.reasons.length > 0 ? result.reasons.join(' · ') : 'Kehadiran penuh, tanpa telat'}
                  </td>
                  <td className="py-2.5 px-1 md:px-3 text-center">
                    {result.reasons.length === 0 && result.workingDays > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span className="hidden sm:inline">PENUH</span> {result.qualifiedDays}/{result.workingDays}
                      </span>
                    ) : result.amount > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {result.qualifiedDays}/{result.workingDays} <span className="hidden sm:inline">HARI</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3 shrink-0" /> <span className="hidden sm:inline">TIDAK ADA</span>
                      </span>
                    )}
                  </td>
                  <td className={`py-2.5 px-1 md:px-3 text-right font-mono font-black ${result.amount > 0 ? 'text-emerald-700' : 'text-rose-300'}`}>
                    {formatIDR(result.amount)}
                    <span className="block text-[9px] font-normal text-gray-400">
                      {result.qualifiedDays} x {formatIDR(result.dailyRate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {evaluations.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-emerald-50/40 font-bold">
                  <td colSpan={6} className="py-2.5 px-1 md:px-3 text-right text-[11px] uppercase tracking-wide text-emerald-800">
                    Total akan cair ({evaluations.filter(e => e.result.amount > 0).length} dari {evaluations.length} karyawan):
                  </td>
                  <td className="py-2.5 px-1 md:px-3 text-right font-mono text-emerald-800">{formatIDR(totalCair)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      )}

      {view === 'slip' && (
      <div className="space-y-4">
        {/* Kartu ringkasan — sejajar dengan tab Gaji Mingguan */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-800/10 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Total Cair</span>
            <p className="text-sm font-bold font-mono text-emerald-950 mt-1">{formatIDR(slipTotals.cairTotal)}</p>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-800/10 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Sudah Dibayar</span>
            <p className="text-sm font-bold font-mono text-emerald-950 mt-1">{formatIDR(slipTotals.paidTotal)}</p>
            <p className="text-[10px] text-gray-400">{slipTotals.paidCount} slip</p>
          </div>
          <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">Belum Dibayar</span>
            <p className="text-sm font-bold font-mono text-amber-800 mt-1">{formatIDR(slipTotals.unpaidTotal)}</p>
            <p className="text-[10px] text-amber-600/80">{slipTotals.unpaidCount} slip</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Gugur</span>
            <p className="text-sm font-bold font-mono text-rose-400 mt-1">{slipTotals.gugurCount} slip</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-gray-400" /> Buku Slip Bonus Kehadiran
            </h3>
            <button
              type="button"
              onClick={handleExportBonusExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-emerald-800 border border-emerald-800/30 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Ekspor Rekap (Excel)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
              <div className="bg-gray-50 p-1 rounded-xl border border-gray-200 inline-flex gap-1">
                <button type="button" onClick={() => { setSlipListView('aktif'); setSlipPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${slipListView === 'aktif' ? 'bg-[var(--color-evergreen)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  Belum Dibayar
                  {slipTotals.unpaidCount > 0 && <span className={`ml-1.5 text-[10px] font-mono px-1.5 rounded-full ${slipListView === 'aktif' ? 'bg-white/20' : 'bg-amber-100 text-amber-800'}`}>{slipTotals.unpaidCount}</span>}
                </button>
                <button type="button" onClick={() => { setSlipListView('arsip'); setSlipPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${slipListView === 'arsip' ? 'bg-[var(--color-evergreen)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  Arsip Lunas
                  {slipTotals.paidCount > 0 && <span className={`ml-1.5 text-[10px] font-mono px-1.5 rounded-full ${slipListView === 'arsip' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-800'}`}>{slipTotals.paidCount}</span>}
                </button>
              </div>
              <DivisionFilter value={riwayatDivFilter} onChange={setRiwayatDivFilter} />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setSlipPage(1); }}
                placeholder="Cari nama karyawan..."
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-full sm:w-48 focus:outline-none focus:ring-1 focus:ring-evergreen"
              />
              <span className="text-[10px] text-gray-400 sm:ml-auto">
                {flatSlips.length === 0
                  ? (search.trim() || riwayatDivFilter
                      ? 'Tidak ada slip bonus yang cocok dengan pencarian/filter.'
                      : slipListView === 'arsip' ? 'Belum ada slip bonus lunas.' : 'Tidak ada slip bonus yang menunggu pembayaran.')
                  : `Menampilkan ${pagedSlips.length} dari ${flatSlips.length} slip${slipTotalPages > 1 ? ` (halaman ${slipPageClamped}/${slipTotalPages})` : ''}`}
              </span>
            </div>

            {flatSlips.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200">
                {(search.trim() || riwayatDivFilter)
                  ? 'Tidak ada slip bonus yang cocok dengan pencarian/filter.'
                  : slipListView === 'arsip' ? 'Belum ada slip bonus yang ditandai lunas.' : 'Tidak ada slip bonus yang menunggu pembayaran.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-emerald-800/10 border-t-0 shadow-inner bg-emerald-50/5">
                <table className="w-full text-left border-collapse text-[11px] md:text-xs border-2 border-evergreen/60 bg-white">
                  <thead>
                    <tr className="bg-evergreen text-white font-bold border-b-2 border-evergreen-dark uppercase text-[10px] tracking-wider text-center">
                      {[{ key: 'name', label: 'Nama Karyawan', align: 'text-left', hideOnMobile: false },
                         { key: 'month', label: 'Bulan', align: 'text-center', hideOnMobile: true },
                         { key: 'days', label: 'Hadir / Layak', align: 'text-center', hideOnMobile: true },
                         { key: 'amount', label: 'Jumlah (IDR)', align: 'text-right', hideOnMobile: false }].map(col => (
                        <th key={col.key} className={`p-2 md:p-3 border-r border-white/30 ${col.align} ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}>
                          <button
                            type="button"
                            onClick={() => toggleSlipSort(col.key)}
                            className="inline-flex items-center gap-1 hover:text-emerald-200 transition-colors cursor-pointer"
                            title={`Urutkan: ${col.label}`}
                          >
                            {col.label}
                            <span className={`text-[8px] leading-none ${slipSort.key === col.key ? 'text-amber-300' : 'text-white/40'}`}>
                              {slipSort.key === col.key ? (slipSort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                            </span>
                          </button>
                        </th>
                      ))}
                      <th className="hidden md:table-cell p-3 border-r border-white/30 text-left">Detail Penilaian</th>
                      <th className="p-2 md:p-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-200">
                    {pagedSlips.map(p => (
                      <tr key={p.id} className="hover:bg-emerald-50/40 transition-colors font-medium text-gray-700">
                        <td className="p-1.5 md:p-3 border-r border-emerald-100/70 font-bold text-emerald-950">
                          {p.employee_name}
                          {p.status === 'gugur' && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold uppercase align-middle">Gugur</span>}
                          {/* Di HP kolom Bulan/Hadir/Detail jadi sub-baris di bawah nama supaya tabel tetap muat */}
                          <span className="block md:hidden text-[10px] font-normal text-gray-500 mt-0.5">
                            {monthLabel(p.month)} · {p.present_days}/{p.working_days} hari
                            {p.late_minutes_net > 0 && ` · telat ${p.late_minutes_net} mnt`}
                            {p.half_days > 0 && ` · setengah ${p.half_days}x`}
                          </span>
                          {p.status === 'gugur' && p.reason && (
                            <span className="block md:hidden text-[10px] text-rose-600 font-bold">{p.reason}</span>
                          )}
                        </td>
                        <td className="hidden md:table-cell p-3 border-r border-emerald-100/70 font-mono text-center text-[11px] text-gray-600 bg-gray-50/10">
                          {monthLabel(p.month)}
                        </td>
                        <td className="hidden md:table-cell p-3 border-r border-emerald-100/70 text-center text-gray-600">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/50 rounded-full font-bold text-[10px]">
                            {p.present_days}/{p.working_days} Hari
                          </span>
                        </td>
                        <td className={`p-1.5 md:p-3 border-r border-emerald-100/70 text-right font-mono font-bold text-[13px] md:text-sm bg-emerald-50/25 ${p.status === 'cair' ? 'text-emerald-950' : 'text-rose-400'}`}>
                          {p.status === 'cair' ? formatIDR(p.amount) : 'Rp0'}
                        </td>
                        <td className="hidden md:table-cell p-3 border-r border-emerald-100/70 text-[11px] text-gray-500 font-mono space-y-0.5">
                          {(() => {
                            // Tarif asli = setting bonus/hari karyawan (tersimpan di slip saat
                            // diterbitkan). Jangan bagi amount dengan present_days: hari telat
                            // hanya mengurangi hari layak, bukan menurunkan tarifnya.
                            const emp = employeeById.get(p.employee_id);
                            const { days: hariLayak, rate: tarif } = bonusHariLayakTarif(p, emp, emp ? bonusOf(emp) : 0);
                            return (
                              <>
                                <div className="flex justify-between gap-2 border-b border-gray-100 pb-0.5">
                                  <span>Hari Layak:</span>
                                  <span className="font-bold text-gray-700">{hariLayak} hari</span>
                                </div>
                                {p.late_minutes_net > 0 && (
                                  <div className="flex justify-between gap-2 border-b border-gray-100 pb-0.5 text-rose-600 font-bold">
                                    <span>Telat (net):</span>
                                    <span>{p.late_minutes_net} mnt</span>
                                  </div>
                                )}
                                {p.half_days > 0 && (
                                  <div className="flex justify-between gap-2 border-b border-gray-100 pb-0.5 text-amber-600 font-bold">
                                    <span>Setengah hari:</span>
                                    <span>{p.half_days}x</span>
                                  </div>
                                )}
                                {p.status === 'cair' && tarif > 0 && (
                                  <div className="flex justify-between gap-2 text-emerald-700 font-bold">
                                    <span>Tarif:</span>
                                    <span>{hariLayak} × {formatIDR(tarif)}</span>
                                  </div>
                                )}
                                {p.status === 'gugur' && p.reason && (
                                  <div className="text-rose-600 font-bold pt-0.5" title={p.reason}>
                                    {p.reason}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </td>
                        <td className="p-1.5 md:p-3 text-center bg-gray-50/5">
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                            <button type="button" onClick={() => handlePrintBonusSlip(p)}
                              className="inline-flex items-center gap-1.5 bg-evergreen hover:bg-evergreen-dark text-white px-2 py-1.5 rounded-lg text-[10px] font-bold shadow-xs transition-colors cursor-pointer"
                              title="Pratinjau & Cetak Slip Bonus (A4)">
                              <Printer className="w-3.5 h-3.5" />
                              <span>{p.payment_status === 'paid' ? 'Cetak Ulang' : 'Cetak Slip'}</span>
                            </button>
                            {p.status === 'cair' && (
                              <button type="button" onClick={() => handleTogglePaid(p)}
                                className={`text-[10px] font-bold px-2 py-1.5 rounded-lg cursor-pointer ${p.payment_status === 'paid'
                                  ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                                {p.payment_status === 'paid' ? 'Batalkan Lunas' : 'Tandai Lunas'}
                              </button>
                            )}
                            <button type="button" onClick={() => setDeletePayoutId(p.id)}
                              className="inline-flex items-center justify-center p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
                              title="Hapus Slip Bonus">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {slipTotalPages > 1 && (
              <div className="p-3 bg-emerald-50/20 rounded-b-lg border border-emerald-800/10 border-t-0 flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  disabled={slipPageClamped <= 1}
                  onClick={() => setSlipPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg font-bold border border-emerald-800/20 bg-white text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-emerald-50"
                >
                  &larr; Sebelumnya
                </button>
                <span className="font-mono text-gray-500">Halaman {slipPageClamped} dari {slipTotalPages}</span>
                <button
                  type="button"
                  disabled={slipPageClamped >= slipTotalPages}
                  onClick={() => setSlipPage(p => Math.min(slipTotalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg font-bold border border-emerald-800/20 bg-white text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-emerald-50"
                >
                  Berikutnya &rarr;
                </button>
              </div>
            )}
        </div>
      </div>
      )}

    </div>

    {/* Pratinjau slip bonus sebelum cetak — sejajar dengan slip gaji mingguan */}
    {previewPayout && (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto overscroll-contain no-print font-sans">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col my-auto max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)]">
          <div className="bg-slate-50 border-b border-slate-100 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
              <span className="font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-wider">Pratinjau Slip Bonus (A4)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewPayout(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => triggerPrintBonusSlip(previewPayout)}
                className="bg-emerald-800 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-900 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Sekarang
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-6 bg-slate-200 min-h-0 flex-1 overflow-auto overscroll-contain">
            <A4PreviewSheet>
              {renderBonusSlipLayout(previewPayout, divisionLabel(employeeDept.get(previewPayout.employee_id), 'Umum'))}
            </A4PreviewSheet>
          </div>
          <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2">
            <span>● Slip dicetak pada kertas A4 biasa atau disimpan sebagai PDF.</span>
            <span className="font-semibold text-slate-700">Pilih &quot;Save as PDF&quot; di dialog cetak bila ingin disimpan.</span>
          </div>
        </div>
      </div>
    )}

    {/* Konfirmasi hapus slip bonus (per-slip) */}
    {deletePayoutId && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print animate-fade-in"
        onClick={() => setDeletePayoutId('')}
      >
        <div
          className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 text-center relative animate-scale-up"
          onClick={e => e.stopPropagation()}
        >
          <Trash2 className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h4 className="font-bold text-base text-gray-800 mb-1">Hapus Slip Bonus?</h4>
          <p className="text-xs text-gray-500 leading-relaxed mb-5">
            Slip bonus karyawan ini akan dihapus permanen dari buku. Riwayat absensi tidak terpengaruh.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeletePayoutId('')}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirmDeletePayout}
              className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
            >
              Ya, Hapus
            </button>
          </div>
        </div>
      </div>
    )}

    {printPayout && (
      <div className="print-only" style={{ width: '180mm', boxSizing: 'border-box' }}>
        {renderBonusSlipLayout(printPayout, divisionLabel(employeeDept.get(printPayout.employee_id), 'Umum'))}
      </div>
    )}
    </>
  );
};
