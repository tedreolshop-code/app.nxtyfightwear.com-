import React, { useState, useEffect } from 'react';
import { dataStore, wibTodayStr } from '../dataStore';
import { Employee, Attendance, PayrollWeekly } from '../types';
import { Clock, Calendar, FileText, CheckCircle2, Fingerprint, MapPin, ExternalLink } from 'lucide-react';

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
    setAttendanceLogs(dataStore.getAttendance());
    setPayrolls(dataStore.getPayrollWeekly());

    const handleStorageChange = () => {
      setAttendanceLogs(dataStore.getAttendance());
      setPayrolls(dataStore.getPayrollWeekly());
    };

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

  // Calendar setup (Current month)
  const getDaysInMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const daysInMonth = getDaysInMonth();
  const currentMonthName = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header */}
      <div className="bg-[#1F4B36] text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">Selamat Datang di ARI SPORTINDO,</span>
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

      {/* Grid: Clock & single attendance entry point vs Today Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Box 1: Widget Jam & QR attendance action */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 md:col-span-2">
          <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Fingerprint className="w-4 h-4 text-[#1F4B36]" /> Absensi QR Lokasi
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Realtime clock display */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center flex flex-col justify-center items-center">
              <span className="text-xs font-bold text-[#1F4B36] uppercase tracking-widest">{dayName}</span>
              <span className="text-3xl font-black font-mono text-gray-800 my-1 tracking-wider">{time || '--:--:--'}</span>
              <span className="text-[10px] text-gray-400 font-semibold">{dateStr}</span>
            </div>

            {/* Info lokasi GPS */}
            <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs flex flex-col justify-center">
              <span className="font-bold text-gray-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#1F4B36] shrink-0" /> Scan QR di Lokasi
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
                : 'bg-[#1F4B36] hover:bg-[#163826] text-white border-transparent cursor-pointer shadow-xs'
            }`}
          >
            <Fingerprint className="w-5 h-5" /> {nextAttendanceLabel}
          </button>
        </div>

        {/* Box 2: Indikator Status Hari Ini */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
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

      {/* Grid: Kalender Kehadiran & Slip Gaji */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Box 3: Kalender Kehadiran Pribadi Bulanan */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#1F4B36]" /> Kalender Kehadiran Pribadi
            </h3>
            <span className="text-xs font-bold text-[#1F4B36]">{currentMonthName}</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
            <span>Min</span><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center">
            {/* Pad calendar starting day */}
            {Array.from({ length: daysInMonth[0]?.getDay() || 0 }).map((_, i) => (
              <div key={`pad-${i}`} className="p-2"></div>
            ))}
            
            {/* Calendar Days */}
            {daysInMonth.map((date, idx) => {
              const dayStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              const logOnDay = myLogs.find(l => l.timestamp.split('T')[0] === dayStr);
              const isToday = dayStr === todayIso;

              let dayBg = 'bg-gray-50 hover:bg-gray-100 text-gray-700';
              if (logOnDay) {
                dayBg = logOnDay.status === 'anomaly' 
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 font-extrabold border border-amber-300' 
                  : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-extrabold border border-emerald-300';
              } else if (isToday) {
                dayBg = 'bg-blue-50 text-blue-700 font-black border-2 border-blue-500';
              }

              return (
                <div
                  key={idx}
                  className={`p-2 rounded-lg text-xs font-mono font-medium transition-colors flex flex-col items-center justify-between cursor-pointer ${dayBg}`}
                  title={logOnDay ? `Absen: ${logOnDay.status === 'anomaly' ? 'Data lama luar radius' : 'Hadir'}` : 'Tanpa Scan'}
                >
                  <span>{date.getDate()}</span>
                  {logOnDay && (
                    <span className={`w-1 h-1 rounded-full mt-1 ${logOnDay.status === 'anomaly' ? 'bg-amber-600' : 'bg-emerald-600'}`}></span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-100 pt-3 flex items-center gap-4 text-[10px] font-bold">
            <div className="flex items-center gap-1 text-emerald-700">
              <span className="w-2.5 h-2.5 bg-emerald-100 border border-emerald-300 rounded"></span>
              <span>Hadir (Normal)</span>
            </div>
            <div className="flex items-center gap-1 text-amber-700">
              <span className="w-2.5 h-2.5 bg-amber-100 border border-amber-300 rounded"></span>
              <span>Data Lama Luar Radius</span>
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <span className="w-2.5 h-2.5 bg-gray-50 border border-gray-200 rounded"></span>
              <span>Hari Kerja Biasa</span>
            </div>
          </div>
        </div>

        {/* Box 4: Slip Gaji Digital Terakhir */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#1F4B36]" /> Slip Gaji Digital Terakhir
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
                  <div className="flex justify-between py-1.5 font-medium">
                    <span className="text-gray-500">Gaji Pokok / Harian</span>
                    <span className="font-bold font-mono text-gray-800">Rp {myLastPayroll.base_pay.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-medium">
                    <span className="text-gray-500">Bonus / Insentif Lembur</span>
                    <span className="font-bold font-mono text-emerald-700">+ Rp {myLastPayroll.bonus.toLocaleString('id-ID')}</span>
                  </div>
                  {myLastPayroll.cash_advance_deduction > 0 && (
                    <div className="flex justify-between py-1.5 font-medium text-rose-600">
                      <span>Potongan Kasbon</span>
                      <span className="font-bold font-mono">- Rp {myLastPayroll.cash_advance_deduction.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 text-sm font-black text-[#1F4B36]">
                    <span>Total Bersih Diterima</span>
                    <span className="font-mono">Rp {myLastPayroll.total_pay.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-[10px] text-gray-400 mb-2">Slip Gaji ini sah dikeluarkan secara digital oleh PT ARI SPORTINDO.</p>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#1F4B36] hover:underline cursor-pointer">
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
