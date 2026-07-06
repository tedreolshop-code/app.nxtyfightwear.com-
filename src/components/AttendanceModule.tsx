import React, { useState, useEffect } from 'react';
import { Employee, Attendance, AttendanceType } from '../types';
import { dataStore, wibNowISO } from '../dataStore';
import { 
  MapPin, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Lock, 
  ShieldAlert, 
  UserCheck, 
  Search, 
  Grid, 
  List, 
  RefreshCw, 
  HelpCircle, 
  Check, 
  Smartphone, 
  Map, 
  Users, 
  ShieldCheck, 
  Calendar,
  AlertCircle
} from 'lucide-react';

interface AttendanceModuleProps {
  isAdmin: boolean;
  // Portal karyawan: kiosk terkunci ke karyawan ini (sudah terautentikasi PIN saat login, tanpa PIN ulang)
  lockedEmployee?: Employee | null;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({ isAdmin, lockedEmployee }) => {
  // Navigation Mode
  const [activeMode, setActiveMode] = useState<'pola_a_kiosk' | 'pola_b_dashboard'>('pola_a_kiosk');

  // Common states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  
  // Search state for employee selector
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Employee & Scan Details
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pin, setPin] = useState('');
  const [scanType, setScanType] = useState<AttendanceType>('masuk');
  
  // Status pembacaan GPS saat kirim scan
  const [isScanning, setIsScanning] = useState(false);

  // Status message and successful scan overlay state
  const [statusMessage, setStatusMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [successOverlay, setSuccessOverlay] = useState<{
    visible: boolean;
    employeeName: string;
    type: AttendanceType;
    status: 'normal' | 'anomaly';
    distance: number;
    time: string;
  } | null>(null);

  // Real-time Clock for Kiosk mode
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadData();
    // Start real-time clock
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener('nxty_storage_change', handleStorageChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener('nxty_storage_change', handleStorageChange);
    };
  }, []);

  const loadData = () => {
    setEmployees(dataStore.getEmployees().filter(e => e.status_aktif));
    setAttendanceLogs(dataStore.getAttendance());
  };

  // Portal karyawan: kunci pilihan ke diri sendiri & paksa mode kiosk
  useEffect(() => {
    if (lockedEmployee) {
      setSelectedEmpId(lockedEmployee.id);
      setActiveMode('pola_a_kiosk');
    }
  }, [lockedEmployee]);

  // Numpad key triggers for Kiosk mode PIN Pad
  const handleNumpadClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleNumpadClear = () => {
    setPin('');
  };

  const handleNumpadBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  // Submit scan handler
  const handleAttendanceSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStatusMessage(null);

    if (!selectedEmpId) {
      setStatusMessage({ text: 'Pilih nama karyawan terlebih dahulu.', error: true });
      return;
    }

    const emp = employees.find(x => x.id === selectedEmpId);
    if (!emp) return;

    // Karyawan yang login lewat portal sudah terverifikasi PIN — tidak perlu PIN ulang
    if (!lockedEmployee) {
      if (!pin) {
        setStatusMessage({ text: 'PIN verifikasi harus diisi.', error: true });
        return;
      }

      if (!dataStore.verifyEmployeePin(emp.id, pin)) {
        setStatusMessage({ text: 'PIN salah! Silakan coba lagi.', error: true });
        return;
      }
    }

    // Penanda perangkat (untuk audit dari perangkat mana scan dilakukan)
    let deviceToken = localStorage.getItem(`nxty_device_token_${emp.id}`);
    if (!deviceToken) {
      deviceToken = `device-bind-${emp.id}-${Math.random().toString(36).substring(7)}`;
      localStorage.setItem(`nxty_device_token_${emp.id}`, deviceToken);
    }

    if (!navigator.geolocation) {
      setStatusMessage({ text: 'Perangkat/browser ini tidak mendukung GPS. Gunakan browser lain.', error: true });
      return;
    }

    setIsScanning(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const result = dataStore.recordAttendance({
            employee_id: emp.id,
            timestamp: wibNowISO(),
            type_scan: scanType,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            selfie_url: '',
            device_token: deviceToken!,
            note: `Kiosk Terminal Scan (GPS perangkat, akurasi ±${Math.round(pos.coords.accuracy)} m)`
          });

          // Launch Big Success Overlay (Auto disappears in 3 seconds)
          const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
          setSuccessOverlay({
            visible: true,
            employeeName: emp.name,
            type: scanType,
            status: result.status,
            distance: Math.round(result.distance_meters),
            time: nowStr
          });

          // Clear states for next check-in (portal karyawan tetap terkunci ke dirinya)
          setPin('');
          setSelectedEmpId(lockedEmployee ? lockedEmployee.id : '');
          loadData();

          // Auto dismiss success overlay after 3.5 seconds
          setTimeout(() => {
            setSuccessOverlay(null);
          }, 3500);
        } catch (err: any) {
          setStatusMessage({ text: err.message || 'Gagal menyimpan absensi.', error: true });
        } finally {
          setIsScanning(false);
        }
      },
      (err) => {
        setIsScanning(false);
        if (err.code === err.PERMISSION_DENIED) {
          setStatusMessage({ text: 'Akses lokasi ditolak. Izinkan akses lokasi untuk situs ini di pengaturan browser, lalu coba lagi.', error: true });
        } else {
          setStatusMessage({ text: `Gagal membaca lokasi GPS (${err.message}). Pastikan GPS aktif lalu coba lagi.`, error: true });
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Filter employees for the list view
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats calculation for Pola B Dashboard
  const stats = {
    totalKaryawan: employees.length,
    hadirHariIni: attendanceLogs.filter(l => l.type_scan === 'masuk').length,
    anomaliHariIni: attendanceLogs.filter(l => l.status === 'anomaly').length,
    pulangHariIni: attendanceLogs.filter(l => l.type_scan === 'pulang').length
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. SELECTION BAR (POLA CONTROL TOGGLE) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5 no-print">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-[#1F4B36] rounded-lg">
              <Clock className="w-5 h-5" />
            </span>
            Sistem Absensi Karyawan
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Verifikasi ganda: PIN, lokasi GPS (radius 100 meter dari pabrik), dan foto selfie.</p>
        </div>

        {/* Toggle Mode Option A / Option B (disembunyikan di portal karyawan) */}
        {!lockedEmployee && (
        <div className="bg-gray-100 p-1 rounded-xl border border-gray-200/60 flex items-center shrink-0">
          <button
            onClick={() => {
              setActiveMode('pola_a_kiosk');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'pola_a_kiosk' 
                ? 'bg-[#1F4B36] text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Absensi (Tablet Bersama)
          </button>
          <button
            onClick={() => {
              setActiveMode('pola_b_dashboard');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'pola_b_dashboard' 
                ? 'bg-[#1F4B36] text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Riwayat & Pemantauan
          </button>
        </div>
        )}
      </div>

      {/* 2. SUCCESS OVERLAY MODAL (Real kiosk experience!) */}
      {successOverlay && (
        <div className="fixed inset-0 bg-[#0F291D]/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-emerald-500/30 text-center space-y-6 shadow-2xl relative overflow-hidden">
            {/* Background glowing effects */}
            <div className={`absolute top-0 inset-x-0 h-2 ${successOverlay.status === 'anomaly' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-600">
              {successOverlay.status === 'anomaly' ? (
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 animate-bounce">
                  <AlertTriangle className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                ABSENSI {successOverlay.type.toUpperCase()} BERHASIL
              </span>
              <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">{successOverlay.employeeName}</h3>
              <p className="text-xs text-gray-500 font-mono">Pukul {successOverlay.time} WIB &bull; Status: {successOverlay.status === 'anomaly' ? 'Di Luar Area Pabrik' : 'Normal / Aman'}</p>
            </div>

            {/* Geofence status info */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-xs space-y-2 font-medium text-left">
              <div className="flex justify-between items-center text-gray-600">
                <span>Jarak dari Pabrik:</span>
                <span className="font-mono font-bold text-gray-800">{successOverlay.distance} Meter</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Verifikasi GPS:</span>
                {successOverlay.status === 'anomaly' ? (
                  <span className="text-amber-600 font-bold flex items-center gap-1">❌ Di luar radius</span>
                ) : (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">✅ Masuk radius</span>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-400 animate-pulse pt-2">
              Layar akan otomatis di-reset dalam 3 detik untuk karyawan berikutnya...
            </div>
            
            <button 
              onClick={() => setSuccessOverlay(null)}
              className="w-full bg-[#1F4B36] text-white text-xs py-2.5 rounded-xl font-bold hover:bg-opacity-95"
            >
              Tutup Sekarang
            </button>
          </div>
        </div>
      )}

      {/* 3. MODE IMPLEMENTATION */}
      {activeMode === 'pola_a_kiosk' ? (
        
        /* -------------------------------------------------------------
           POLA A: DEDICATED KIOSK TERMINAL (Shared Factory Device)
           ------------------------------------------------------------- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT SIDE: PANDUAN PENGGUNAAN (4 Columns on Desktop) */}
          <div className="lg:col-span-4 space-y-4 no-print">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs text-left">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#1F4B36]" />
                <h3 className="font-extrabold text-sm text-gray-800">Cara Absen</h3>
              </div>
              <ol className="list-decimal pl-4 space-y-1.5 text-xs text-gray-600 leading-relaxed font-medium">
                <li><span className="font-bold">Pilih nama Anda</span> pada daftar karyawan di sebelah kanan.</li>
                <li><span className="font-bold">Pilih tipe absen</span>: Masuk atau Pulang kerja.</li>
                <li><span className="font-bold">Masukkan PIN pribadi</span> 4 digit lewat tombol angka.</li>
                <li>Tekan <span className="font-bold">KIRIM SCAN ABSENSI</span> dan izinkan akses lokasi bila diminta.</li>
              </ol>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2 shadow-xs text-left">
              <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#1F4B36]" /> Verifikasi Lokasi GPS
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Lokasi diambil otomatis dari <b>GPS perangkat ini</b> saat tombol absen ditekan,
                lalu dicocokkan dengan titik kantor. Absen di luar radius <b>100 meter</b> tetap
                tercatat namun ditandai <b>anomali</b> dan dilaporkan ke owner.
              </p>
              <p className="text-[10px] text-gray-400">
                Pastikan GPS aktif dan izinkan akses lokasi saat browser meminta. Jaga kerahasiaan PIN Anda.
              </p>
            </div>
          </div>

          {/* RIGHT SIDE: INTERACTIVE TOUCH KIOSK (8 Columns on Desktop) */}
          <div className="lg:col-span-8 bg-[#122F21] rounded-3xl border border-[#163826] shadow-xl overflow-hidden text-left text-white">
            
            {/* Header Kiosk */}
            <div className="bg-[#1F4B36] px-6 py-5 border-b border-[#163826] flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-800/40 border border-emerald-600/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight text-white uppercase">Terminal Absensi Terpadu</h3>
                  <p className="text-[10px] text-emerald-200/80 font-medium">Sistem Digital &bull; CV. ARI SPORTINDO</p>
                </div>
              </div>

              {/* Digital Live Clock Widget */}
              <div className="text-center sm:text-right bg-black/20 px-4 py-2 rounded-xl border border-white/5 font-mono">
                <div className="text-lg font-black tracking-widest text-amber-400">
                  {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' })}
                </div>
                <div className="text-[8px] uppercase font-bold tracking-wider text-emerald-200">
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })}
                </div>
              </div>
            </div>

            {/* Core Kiosk Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Box A: Employee Selector (7 Columns on md+) */}
              <div className="md:col-span-7 space-y-4">
                {lockedEmployee ? (
                  /* Portal karyawan: identitas terkunci, tidak bisa absen atas nama orang lain */
                  <div className="bg-[#163826] border border-amber-400/40 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center font-black text-amber-800 text-lg shrink-0">
                      {lockedEmployee.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{lockedEmployee.name}</p>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Login Terverifikasi PIN</p>
                    </div>
                  </div>
                ) : (
                <>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-emerald-300 tracking-wider">Langkah 1: Pilih Nama Anda</h4>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded font-bold font-mono">
                    {filteredEmployees.length} Terdaftar
                  </span>
                </div>

                {/* Live Search Input */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-300/60">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Ketik nama karyawan untuk mencari..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#163826] border border-[#235339] text-white placeholder-emerald-200/50 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-medium transition-all"
                  />
                </div>

                {/* Employees Touch-Friendly Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto scrollbar-none pr-1">
                  {filteredEmployees.length === 0 ? (
                    <div className="col-span-2 text-center py-10 text-xs text-emerald-200/50 italic bg-[#163826]/40 rounded-xl">
                      Karyawan tidak ditemukan.
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isSelected = selectedEmpId === emp.id;

                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setSelectedEmpId(emp.id);
                            setStatusMessage(null);
                          }}
                          className={`p-3 rounded-2xl flex items-center gap-3 text-left transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#1F4B36] border-amber-400 text-white shadow-md shadow-black/20 ring-1 ring-amber-400'
                              : 'bg-[#163826]/60 border-[#1c4731] hover:bg-[#163826] hover:border-[#24593e] text-emerald-100'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-full border-2 shrink-0 flex items-center justify-center font-black text-sm ${
                            isSelected ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-emerald-700 bg-emerald-900/60 text-emerald-200'
                          }`}>
                            {emp.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate leading-tight">{emp.name}</p>
                            <p className="text-[9px] uppercase font-bold tracking-wider text-emerald-400">{emp.id.replace('emp-', '')}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                </>
                )}

                {/* Tipe Scan Selector */}
                <div className="space-y-2 pt-2 border-t border-[#1a422d]/60">
                  <h4 className="text-xs font-black uppercase text-emerald-300 tracking-wider">{lockedEmployee ? 'Pilih Tipe Scan' : 'Langkah 2: Pilih Tipe Scan'}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setScanType('masuk')}
                      className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                        scanType === 'masuk'
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-black/10'
                          : 'bg-[#163826]/40 border-[#1d4631] text-emerald-200/70 hover:bg-[#163826]'
                      }`}
                    >
                      <Clock className="w-4 h-4 shrink-0 text-emerald-400" />
                      Scan Masuk Kerja
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanType('pulang')}
                      className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                        scanType === 'pulang'
                          ? 'bg-rose-700 text-white border-rose-500 shadow-md shadow-black/10'
                          : 'bg-[#163826]/40 border-[#1d4631] text-emerald-200/70 hover:bg-[#163826]'
                      }`}
                    >
                      <Clock className="w-4 h-4 shrink-0 text-rose-400" />
                      Scan Pulang Kerja
                    </button>
                  </div>
                </div>
              </div>

              {/* Box B: Interactive NUMPAD (5 Columns on md+) */}
              <div className="md:col-span-5 bg-[#0e2419] p-5 rounded-2xl border border-[#143323] space-y-4">
                {!lockedEmployee && (
                <>
                <div className="text-center">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-400">Langkah 3: Masukkan PIN 4-Digit</h4>
                </div>

                {/* PIN Display Panel */}
                <div className="bg-[#122f21] rounded-xl border border-[#1a422f] p-3 text-center flex justify-center items-center gap-2 font-mono h-12">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                        pin.length > idx 
                          ? 'bg-amber-400 border-amber-400 scale-110 shadow-xs' 
                          : 'border-emerald-800'
                      }`}
                    />
                  ))}
                  {pin.length === 0 && (
                    <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-widest animate-pulse">PIN Kosong</span>
                  )}
                </div>

                {/* Grid 3x4 Touch Numpad */}
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumpadClick(num)}
                      className="h-11 rounded-xl bg-[#163826]/75 hover:bg-[#1f4b36] text-white text-base font-extrabold border border-[#1c4731] transition-all cursor-pointer active:scale-95 flex items-center justify-center shadow-xs"
                    >
                      {num}
                    </button>
                  ))}
                  
                  {/* Row 4: Clear (C), 0, Backspace */}
                  <button
                    type="button"
                    onClick={handleNumpadClear}
                    className="h-11 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold border border-rose-900/20 transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                  >
                    HAPUS
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleNumpadClick('0')}
                    className="h-11 rounded-xl bg-[#163826]/75 hover:bg-[#1f4b36] text-white text-base font-extrabold border border-[#1c4731] transition-all cursor-pointer active:scale-95 flex items-center justify-center shadow-xs"
                  >
                    0
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleNumpadBackspace}
                    className="h-11 rounded-xl bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 text-xs font-bold border border-amber-900/20 transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                  >
                    BATAL
                  </button>
                </div>
                </>
                )}

                {/* Feedback status on current selections */}
                {selectedEmpId && (
                  <div className="bg-[#122f21]/60 p-2.5 rounded-xl border border-[#1a422f] text-[10px] text-emerald-200/90 leading-tight">
                    <span className="font-bold text-white block mb-0.5">Karyawan Terpilih:</span>
                    {employees.find(e => e.id === selectedEmpId)?.name}
                  </div>
                )}

                {/* Status Inline Error/Anomaly info */}
                {statusMessage && (
                  <div className={`p-2.5 rounded-xl text-[11px] leading-relaxed flex items-start gap-1.5 ${
                    statusMessage.error
                      ? 'bg-rose-950/40 text-rose-300 border border-rose-900/30'
                      : 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/30'
                  }`}>
                    {statusMessage.error ? (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    )}
                    <span>{statusMessage.text}</span>
                  </div>
                )}

                {/* MAIN KIOSK SCAN SUBMIT TRIGGER */}
                <button
                  type="button"
                  onClick={() => handleAttendanceSubmit()}
                  disabled={!selectedEmpId || (!lockedEmployee && pin.length < 4) || isScanning}
                  className={`w-full py-3.5 rounded-xl text-xs uppercase font-extrabold tracking-widest flex items-center justify-center gap-2 border transition-all ${
                    (!selectedEmpId || (!lockedEmployee && pin.length < 4) || isScanning)
                      ? 'bg-emerald-950/60 border-emerald-900/40 text-emerald-200/30 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-transparent shadow-md active:scale-[0.98] cursor-pointer'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  {isScanning ? 'MEMBACA LOKASI GPS…' : 'KIRIM SCAN ABSENSI'}
                </button>
              </div>

            </div>

            {/* Bottom Info bar */}
            <div className="bg-[#0e2419] px-6 py-3 border-t border-[#163826] text-[10px] text-emerald-300/60 flex flex-col sm:flex-row justify-between items-center gap-2 font-mono">
              <span>SINKRONISASI GPS: AKTIF (Radius 100m)</span>
              <span>VERSI SISTEM: KIOSK PORTAL ADAPTIVE</span>
            </div>

          </div>

        </div>

      ) : (

        /* -------------------------------------------------------------
           POLA B: REAL-TIME MONITORING HRD (Admin Recap & Logs)
           ------------------------------------------------------------- */
        <div className="space-y-6">
          
          {/* Real-time stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Karyawan</p>
                <p className="text-lg font-black text-gray-800">{stats.totalKaryawan} Orang</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hadir Hari Ini</p>
                <p className="text-lg font-black text-gray-800">{stats.hadirHariIni} Orang</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Deteksi Anomali</p>
                <p className="text-lg font-black text-rose-600">{stats.anomaliHariIni} Log</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pulang Shift</p>
                <p className="text-lg font-black text-gray-800">{stats.pulangHariIni} Karyawan</p>
              </div>
            </div>
          </div>

          {/* Grid Layout: Map Representation vs Raw Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Box: Geofence Safe Zone Map Simulation (5 Columns) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs text-left no-print">
              <div>
                <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-2">
                  <Map className="w-4 h-4 text-[#1F4B36]" /> Visualisasi Geofence Pabrik
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Representasi radar lokasi check-in dari koordinat latitude & longitude.</p>
              </div>

              {/* Fake Interactive Map Canvas Area */}
              <div className="border border-gray-150 rounded-2xl p-4 bg-slate-900 text-white relative h-72 overflow-hidden flex items-center justify-center">
                {/* Geofence Circles */}
                <div className="absolute w-56 h-56 rounded-full border border-emerald-500/30 bg-emerald-500/5 animate-pulse flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border border-emerald-400/40 bg-emerald-400/10 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-2 border-emerald-300 bg-emerald-500/25 flex items-center justify-center">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-300">Pabrik</span>
                    </div>
                  </div>
                </div>

                {/* Center Core dot */}
                <div className="absolute w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-lg ring-4 ring-emerald-500/50" />

                {/* Simulated Pins */}
                <div className="absolute top-24 left-32 flex flex-col items-center">
                  <div className="px-1.5 py-0.5 bg-emerald-600 text-white font-mono text-[8px] rounded shadow-md">Siti (Normal)</div>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full border border-white mt-1 animate-ping" />
                </div>

                <div className="absolute bottom-20 right-36 flex flex-col items-center">
                  <div className="px-1.5 py-0.5 bg-emerald-600 text-white font-mono text-[8px] rounded shadow-md">Asep (Normal)</div>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full border border-white mt-1 animate-ping" />
                </div>

                <div className="absolute top-12 right-12 flex flex-col items-center animate-pulse">
                  <div className="px-1.5 py-0.5 bg-rose-600 text-white font-mono text-[8px] rounded shadow-md">Budi (Anomali: 610m)</div>
                  <div className="w-2.5 h-2.5 bg-rose-500 rounded-full border border-white mt-1" />
                </div>

                {/* Map Grid Grid Lines */}
                <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-5 pointer-events-none">
                  {[...Array(36)].map((_, i) => <div key={i} className="border border-white" />)}
                </div>

                {/* Radar Line sweep */}
                <div className="absolute top-1/2 left-1/2 w-64 h-[1px] bg-emerald-500/30 origin-left animate-spin" style={{ animationDuration: '6s' }} />

                {/* Coordinates Legend */}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs px-2 py-1 rounded text-[9px] font-mono border border-white/5 space-y-0.5">
                  <p className="text-emerald-400">&bull; Geofence Aman: 100m</p>
                  <p className="text-rose-500">&bull; Anomali Terdeteksi: Di Luar Zone</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-150 rounded-xl p-3 text-[11px] text-gray-500 leading-relaxed font-medium">
                <span className="font-bold text-gray-800 block mb-0.5">Keterangan Aturan Lokasi:</span>
                Setiap scan masuk/pulang karyawan dihitung jarak lurusnya ke koordinat pusat departemen pabrik. 
                Jika jarak melebihi 100 meter, status di-tandai sebagai <span className="font-bold text-rose-600">ANOMALI</span> dan data koordinat disimpan sebagai lampiran pertimbangan pembayaran gaji HRD.
              </div>
            </div>

            {/* Right Box: Detailed Raw Logs (7 Columns) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs text-left">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#1F4B36]" /> Riwayat Log Absensi Lengkap
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Semua data scan absensi karyawan yang tersinkronisasi.</p>
                </div>

                {/* Clean Button */}
                <button
                  onClick={loadData}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-all cursor-pointer border border-gray-200"
                  title="Segarkan Log"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Logs Stream Container */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {attendanceLogs.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    Belum ada data scan absensi terekam hari ini. Silakan test absen menggunakan menu Pola A.
                  </p>
                ) : (
                  [...attendanceLogs].reverse().map((log) => {
                    const isAnomaly = log.status === 'anomaly';
                    const dateObj = new Date(log.timestamp);
                    const formattedDate = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                    const timeString = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={log.id}
                        className={`p-4 rounded-xl border text-xs transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${
                          isAnomaly ? 'bg-amber-50/50 border-amber-200/80 text-gray-800' : 'bg-gray-50 border-gray-150 text-gray-700'
                        }`}
                      >
                        <div className="flex gap-3 items-center min-w-0">
                          {/* Face Selfie Thumbnail */}
                          <div className="shrink-0 w-11 h-11 rounded-full overflow-hidden border border-gray-200/80 bg-emerald-50 flex items-center justify-center">
                            {log.selfie_url
                              ? <img src={log.selfie_url} alt="Selfie" className="w-full h-full object-cover" />
                              : <span className="text-sm font-black text-emerald-700">{(log.employee_name || '?').charAt(0)}</span>}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-gray-950 truncate text-[13px]">{log.employee_name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                log.type_scan === 'masuk' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {log.type_scan}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 font-medium">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                {formattedDate} - {timeString} WIB
                              </span>
                              <span className="flex items-center gap-1 font-mono text-[10px]">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                Jarak: {log.distance_meters} Meter
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right side status badge */}
                        <div className="flex flex-col items-end shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-gray-200/60">
                          {isAnomaly ? (
                            <div className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-300">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              Anomali GPS
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-300">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              Normal (Aman)
                            </div>
                          )}
                          <span className="text-[9px] text-gray-400 mt-1 italic font-sans">{log.note || 'Sistem Terkomputerisasi'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>

      )}

    </div>
  );
};
