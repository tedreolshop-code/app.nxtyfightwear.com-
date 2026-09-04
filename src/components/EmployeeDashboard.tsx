import React, { useState, useEffect } from 'react';
import { dataStore, wibTodayStr, currentWeeklyPayrollPeriod, dayFraction } from '../dataStore';
import { brandName, brandLegalName } from '../brand';
import { Employee, Attendance, PayrollWeekly, AttendanceAdjustment } from '../types';
import { Clock, FileText, CheckCircle2, Fingerprint, MapPin, ExternalLink, Wallet } from 'lucide-react';
import { AttendanceBonusBalanceCard } from './AttendanceBonusPanel';
import { AttendanceCalendar } from './AttendanceCalendar';

interface EmployeeDashboardProps {
  loggedEmployee: Employee;
  onOpenAttendance: () => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ loggedEmployee, onOpenAttendance }) => {
  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [dayName, setDayName] = useState<string>('');
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollWeekly[]>([]);
  const [adjustments, setAdjustments] = useState<AttendanceAdjustment[]>([]);

  useEffect(() => {
    // Clock tick — selalu WIB (GMT+7), tidak tergantung zona waktu HP
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('id-ID', { hour12: false, timeZone: 'Asia/Jakarta' }));
      setDateStr(now.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' }));
      setDayName(now.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);

    // Initial load
    const refresh = () => {
      setAttendanceLogs(dataStore.getAttendance());
      setPayrolls(dataStore.getPayrollWeekly());
      setAdjustments(dataStore.getAttendanceAdjustments());
    };
    refresh();

    const handleStorageChange = refresh;

    window.addEventListener('nxty_storage_change', handleStorageChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener('nxty_storage_change', handleStorageChange);
    };
  }, []);

  const todayIso = wibTodayStr();

  // Filters
  const myLogs = attendanceLogs.filter(log => log.employee_id === loggedEmployee.id);
  const myTodayLogs = myLogs.filter(log => log.timestamp.split('T')[0] === todayIso);
  const myLastPayroll = payrolls
    .filter(p => p.employee_id === loggedEmployee.id)
    .sort((a, b) => b.period_end.localeCompare(a.period_end))[0];

  const hasCheckedInToday = myTodayLogs.some(l => l.type_scan === 'masuk');
  const hasCheckedOutToday = myTodayLogs.some(l => l.type_scan === 'pulang');

  const checkInTimeToday = myTodayLogs.find(l => l.type_scan === 'masuk')?.timestamp.split('T')[1]?.substring(0, 5) || '--:--';
  const checkOutTimeToday = myTodayLogs.find(l => l.type_scan === 'pulang')?.timestamp.split('T')[1]?.substring(0, 5) || '--:--';
  const deptName = dataStore.getDepartments().find(dept => dept.id === loggedEmployee.department_id)?.name || 'Umum';
  const nextAttendanceLabel = !hasCheckedInToday ? 'Scan QR Lokasi untuk Absen Masuk' : !hasCheckedOutToday ? 'Scan QR Lokasi untuk Absen Pulang' : 'Absensi Hari Ini Selesai';

  // Pengajuan lembur / Live TikTok yang dikirim saat scan pulang, + status ACC-nya.
  const myRequests = myLogs
    .filter(log => log.overtime_request || log.live_tiktok_request)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8)
    .flatMap(log => {
      const adj = adjustments.find(a => a.attendance_id === log.id);
      const status: 'menunggu' | 'disetujui' | 'ditolak' = !adj ? 'menunggu' : adj.status === 'rejected' ? 'ditolak' : 'disetujui';
      const date = log.timestamp.slice(0, 10);
      const rows: { key: string; date: string; jenis: string; alasan: string; status: typeof status; detail: string }[] = [];
      if (log.overtime_request) rows.push({
        key: `${log.id}-ot`, date, jenis: 'Lembur', alasan: log.overtime_request.reason, status,
        detail: status === 'disetujui' ? `${adj?.overtime_minutes || 0} menit disetujui` : status === 'ditolak' ? (adj?.rejection_reason || 'Ditolak') : 'Menunggu ACC admin',
      });
      if (log.live_tiktok_request) rows.push({
        key: `${log.id}-live`, date, jenis: 'Live TikTok', alasan: log.live_tiktok_request.reason, status,
        detail: status === 'disetujui' ? `Bonus Rp ${(adj?.bonus_amount || 0).toLocaleString('id-ID')}` : status === 'ditolak' ? (adj?.rejection_reason || 'Ditolak') : 'Menunggu ACC admin',
      });
      return rows;
    });

  // Saldo gaji berjalan (periode Sabtu-Jumat), dihitung otomatis dari absensi
  const formatIDR = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  const runningPeriod = currentWeeklyPayrollPeriod();
  const myPeriodAtt = attendanceLogs.filter(a => {
    if (a.employee_id !== loggedEmployee.id) return false;
    const d = a.timestamp.split('T')[0];
    return d >= runningPeriod.start && d <= runningPeriod.end;
  });
  const myPeriodDates = Array.from(new Set(myPeriodAtt.map(a => a.timestamp.split('T')[0])));
  const myRunningDays = myPeriodDates
    .map(date => dayFraction(myPeriodAtt.filter(log => log.timestamp.startsWith(date)), dataStore.getWorkSettings()))
    .reduce((sum: number, value) => sum + value, 0);
  const myPeriodAdjustments: AttendanceAdjustment[] = dataStore.getAttendanceAdjustments()
    .filter(item => item.employee_id === loggedEmployee.id && item.date >= runningPeriod.start && item.date <= runningPeriod.end && item.type !== 'ignored');
  const myRunningOvertimeHours = myPeriodAdjustments.filter(item => item.type === 'overtime').reduce((sum, item) => sum + (item.overtime_minutes || 0), 0) / 60;
  const myRunningLiveBonus = myPeriodAdjustments.filter(item => item.type === 'live_tiktok').reduce((sum, item) => sum + (item.bonus_amount || 0), 0);
  const myRunningPay = myRunningDays * loggedEmployee.rate_harian
    + Math.round(myRunningOvertimeHours * loggedEmployee.rate_lembur_per_jam)
    + myRunningLiveBonus;
  const payDateLabel = new Date(`${runningPeriod.payDate}T12:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' });

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header */}
      <div className="bg-[var(--color-evergreen)] text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">Selamat Datang di {brandName()},</span>
          <h1 className="text-xl font-bold">{loggedEmployee.name}</h1>
          <p className="text-xs text-emerald-100 font-medium uppercase tracking-wider">
            {deptName} &middot; Peran: {loggedEmployee.role}
          </p>
        </div>
        <div className="bg-emerald-800/40 border border-emerald-600/30 rounded-xl p-3 text-right">
          <p className="text-[10px] font-semibold text-emerald-200">ID Pegawai</p>
          <p className="text-sm font-black font-mono tracking-wider text-emerald-100">{loggedEmployee.id}</p>
        </div>
      </div>

      {/* SALDO: gaji berjalan minggu ini + bonus kehadiran bulan ini */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
            <Wallet className="w-4 h-4" /> Saldo Gaji Minggu Ini
          </span>
          <p className="text-2xl font-black font-mono text-emerald-900">{formatIDR(myRunningPay)}</p>
          <p className="text-xs text-emerald-700">
            {myRunningDays} hari hadir × {formatIDR(loggedEmployee.rate_harian)}
            {myRunningOvertimeHours > 0 && <> + lembur {Math.round(myRunningOvertimeHours * 100) / 100} jam</>}
            {myRunningLiveBonus > 0 && <> + bonus live {formatIDR(myRunningLiveBonus)}</>}
          </p>
          <p className="text-[11px] text-emerald-600">
            Periode Sabtu–Jumat · Dibayarkan: <b>{payDateLabel}</b>
          </p>
        </div>
        <AttendanceBonusBalanceCard employee={loggedEmployee} />
      </div>

      {/* Grid: Clock & single attendance entry point vs Today Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Box 1: Widget Jam & QR attendance action */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4 md:col-span-2">
          <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Fingerprint className="w-4 h-4 text-[var(--color-evergreen)]" /> Absensi QR Lokasi
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Realtime clock display */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center flex flex-col justify-center items-center">
              <span className="text-xs font-bold text-[var(--color-evergreen)] uppercase tracking-widest">{dayName}</span>
              <span className="text-3xl font-black font-mono text-gray-800 my-1 tracking-wider">{time || '--:--:--'}</span>
              <span className="text-[10px] text-gray-400 font-semibold">{dateStr}</span>
            </div>

            {/* Info lokasi GPS */}
            <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs flex flex-col justify-center">
              <span className="font-bold text-gray-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--color-evergreen)] shrink-0" /> Scan QR di Lokasi
              </span>
              <p className="text-gray-500 leading-relaxed">
                Absensi dilakukan dari satu pintu: buka kamera, scan QR lokasi pabrik, lalu sistem mencatat
                masuk atau pulang sesuai urutan hari ini.
              </p>
              <p className="text-[10px] text-gray-400">
                Pastikan kamera dan GPS aktif saat browser meminta izin.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenAttendance}
            disabled={hasCheckedInToday && hasCheckedOutToday}
            className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
              hasCheckedInToday && hasCheckedOutToday
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[var(--color-evergreen)] hover:bg-[var(--color-evergreen-dark)] text-white border-transparent cursor-pointer shadow-xs'
            }`}
          >
            <Fingerprint className="w-5 h-5" /> {nextAttendanceLabel}
          </button>
        </div>

        {/* Box 2: Indikator Status Hari Ini */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
          <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Status Kehadiran Hari Ini
          </h3>

          <div className="space-y-4 text-xs font-medium text-gray-600">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100/60">
              <span className="text-gray-500 font-bold">Absen Masuk</span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded ${hasCheckedInToday ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-500'}`}>
                {checkInTimeToday} {hasCheckedInToday && 'WIB'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100/60">
              <span className="text-gray-500 font-bold">Absen Pulang</span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded ${hasCheckedOutToday ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-500'}`}>
                {checkOutTimeToday} {hasCheckedOutToday && 'WIB'}
              </span>
            </div>

            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1">
              <p className="font-bold text-emerald-800 text-[11px] uppercase tracking-wider">Absensi Satu Pintu</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Gunakan tombol sidik jari untuk membuka kamera dan scan QR lokasi. Data absensi akan tersimpan otomatis.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pengajuan lembur / Live TikTok saat scan pulang + status ACC-nya */}
      {myRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-3">
          <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[var(--color-evergreen)]" /> Pengajuan Saya
          </h3>
          <div className="space-y-2">
            {myRequests.map(r => (
              <div key={r.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-gray-800">{r.jenis} · {r.date}</p>
                  <p className="text-gray-500 truncate">{r.alasan}</p>
                  <p className="text-[11px] text-gray-600">{r.detail}</p>
                </div>
                <span className={`shrink-0 self-start sm:self-center rounded-full px-2 py-1 text-[10px] font-black uppercase border ${
                  r.status === 'disetujui' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : r.status === 'ditolak' ? 'bg-rose-50 text-rose-700 border-rose-100'
                  : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {r.status === 'disetujui' ? 'Disetujui' : r.status === 'ditolak' ? 'Ditolak' : 'Menunggu'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Kalender Kehadiran & Slip Gaji */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Box 3: Kalender Kehadiran Pribadi */}
        <AttendanceCalendar logs={myLogs} joinDate={loggedEmployee.join_date} />

        {/* Box 4: Slip Gaji Digital Terakhir */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[var(--color-evergreen)]" /> Slip Gaji Digital Terakhir
            </h3>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[9px] font-black uppercase tracking-wider">E-Slip Terbit</span>
          </div>

          {myLastPayroll ? (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2.5">
                <div className="flex justify-between items-center text-[11px] text-gray-400">
                  <span>Periode Tanggal</span>
                  <span className="font-bold text-gray-600 font-mono">{myLastPayroll.period_start} s/d {myLastPayroll.period_end}</span>
                </div>

                <div className="divide-y divide-gray-200/50">
                  <div className="flex justify-between py-1.5 font-medium">
                    <span className="text-gray-500">Jumlah Hari Kerja</span>
                    <span className="font-bold text-gray-800">{myLastPayroll.days_worked} hari</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-medium">
                    <span className="text-gray-500">Jam Overtime (Lembur)</span>
                    <span className="font-bold text-gray-800">{myLastPayroll.overtime_hours} jam</span>
                  </div>
                  {myLastPayroll.overtime_hours > 0 && (
                    <div className="flex justify-between py-1.5 font-medium">
                      <span className="text-gray-500">Upah Lembur</span>
                      <span className="font-bold font-mono text-emerald-700">+ Rp {(myLastPayroll.overtime_hours * loggedEmployee.rate_lembur_per_jam).toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5 font-medium">
                    <span className="text-gray-500">Gaji Pokok / Harian</span>
                    <span className="font-bold font-mono text-gray-800">Rp {myLastPayroll.base_pay.toLocaleString('id-ID')}</span>
                  </div>
                  {myLastPayroll.bonus > 0 && (
                    <div className="flex justify-between py-1.5 font-medium text-emerald-700">
                      <span className="text-gray-500">Bonus Live TikTok</span>
                      <span className="font-bold font-mono">+ Rp {myLastPayroll.bonus.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {myLastPayroll.cash_advance_deduction > 0 && (
                    <div className="flex justify-between py-1.5 font-medium text-rose-600">
                      <span>Potongan Kasbon</span>
                      <span className="font-bold font-mono">- Rp {myLastPayroll.cash_advance_deduction.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 text-sm font-black text-[var(--color-evergreen)]">
                    <span>Total Bersih Diterima</span>
                    <span className="font-mono">Rp {myLastPayroll.total_pay.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-[10px] text-gray-400 mb-2">Slip Gaji ini sah dikeluarkan secara digital oleh {brandLegalName()}.</p>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-evergreen)] hover:underline cursor-pointer">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Unduh PDF Slip Resmi</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200/80">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              Belum ada catatan slip gaji yang diterbitkan untuk periode ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
