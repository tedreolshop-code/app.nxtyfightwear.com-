import React, { useState, useEffect, useId, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { Employee, Attendance, AttendanceType, WorkSettings } from '../types';
import { dataStore, wibNowISO } from '../dataStore';
import { brandName, brandLegalName } from '../brand';
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
  ,QrCode, X
  ,Settings, Printer
  ,Download, ChevronLeft, ChevronRight
} from 'lucide-react';

interface AttendanceModuleProps {
  isAdmin: boolean;
  // Portal karyawan: kiosk terkunci ke karyawan ini (sudah terautentikasi PIN saat login, tanpa PIN ulang)
  lockedEmployee?: Employee | null;
  assistingAdmin?: Employee | null;
  openLocationScannerSignal?: number;
}

const EmployeeQrScanner: React.FC<{ onScan: (value: string) => void }> = ({ onScan }) => {
  const rawId = useId();
  const elementId = `employee-qr-reader-${rawId.replace(/:/g, '')}`;
  const onScanRef = useRef(onScan);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanCompletedRef = useRef(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const explainCameraError = (error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error || '');
    const lower = raw.toLowerCase();
    if (!window.isSecureContext) {
      return 'Kamera browser hanya bisa aktif lewat HTTPS atau localhost. Buka aplikasi dari domain HTTPS jika memakai HP/tablet/laptop lain.';
    }
    if (lower.includes('permission') || lower.includes('notallowed')) {
      return 'Izin kamera ditolak. Izinkan akses kamera untuk situs ini di pengaturan browser, lalu buka ulang scanner.';
    }
    if (lower.includes('notfound') || lower.includes('device not found') || lower.includes('no cameras')) {
      return 'Kamera tidak ditemukan di perangkat ini. Pastikan kamera tidak sedang dipakai aplikasi lain.';
    }
    if (lower.includes('notreadable') || lower.includes('could not start')) {
      return 'Kamera tidak bisa dinyalakan. Tutup aplikasi lain yang memakai kamera, lalu coba lagi.';
    }
    return raw || 'Kamera gagal dinyalakan. Coba pilih kamera lain atau buka lewat browser Chrome/Safari terbaru.';
  };

  const stopCamera = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
    } finally {
      scanner.clear();
      setIsCameraRunning(false);
    }
  };

  const startCamera = async (cameraId = selectedCameraId) => {
    setCameraError('');
    setIsStartingCamera(true);
    scanCompletedRef.current = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera.');
      }
      if (!window.isSecureContext) {
        throw new Error('Halaman tidak aman untuk akses kamera.');
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(elementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });
      }

      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      const availableCameras = await Html5Qrcode.getCameras();
      setCameras(availableCameras);

      const preferredCamera =
        availableCameras.find(camera => camera.id === cameraId) ||
        availableCameras.find(camera => /back|rear|environment|belakang/i.test(camera.label)) ||
        availableCameras[0];

      if (preferredCamera) setSelectedCameraId(preferredCamera.id);

      const cameraConfig = preferredCamera
        ? preferredCamera.id
        : { facingMode: { ideal: 'environment' } };

      await scannerRef.current.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.max(180, Math.min(260, viewfinderWidth - 32, viewfinderHeight - 32));
            return { width: size, height: size };
          },
          aspectRatio: 1,
          disableFlip: false
        },
        async (decodedText) => {
          if (scanCompletedRef.current) return;
          scanCompletedRef.current = true;
          onScanRef.current(decodedText);
          await stopCamera();
        },
        () => undefined
      );
      setIsCameraRunning(true);
    } catch (error) {
      setCameraError(explainCameraError(error));
      setIsCameraRunning(false);
    } finally {
      setIsStartingCamera(false);
    }
  };

  useEffect(() => {
    void startCamera();
    return () => { void stopCamera(); };
  }, [elementId]);

  return (
    <div className="space-y-3">
      <div id={elementId} className="overflow-hidden rounded-xl bg-gray-950 min-h-[260px] flex items-center justify-center text-xs text-gray-400" />

      {cameraError && (
        <p className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700">
          {cameraError}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        {cameras.length > 1 && (
          <select
            value={selectedCameraId}
            onChange={(event) => {
              setSelectedCameraId(event.target.value);
              void startCamera(event.target.value);
            }}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
          >
            {cameras.map((camera, index) => (
              <option key={camera.id} value={camera.id}>{camera.label || `Kamera ${index + 1}`}</option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={() => void startCamera()}
          disabled={isStartingCamera}
          className="rounded-lg bg-[var(--color-evergreen)] px-4 py-2 text-xs font-bold text-white disabled:cursor-wait disabled:bg-gray-300"
        >
          {isStartingCamera ? 'Menyambungkan...' : isCameraRunning ? 'Muat Ulang Kamera' : 'Nyalakan Kamera'}
        </button>
      </div>
    </div>
  );
};

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({ isAdmin, lockedEmployee, assistingAdmin, openLocationScannerSignal }) => {
  // Navigation Mode
  const [activeMode, setActiveMode] = useState<'pola_a_kiosk' | 'pola_b_dashboard'>('pola_a_kiosk');
  const [adminAttendanceTab, setAdminAttendanceTab] = useState<'summary' | 'recap' | 'history' | 'correction' | 'sync'>('summary');

  // Common states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  
  // Search state for employee selector
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPeriod, setHistoryPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [historyStart, setHistoryStart] = useState(wibNowISO().slice(0, 10));
  const [historyEnd, setHistoryEnd] = useState(wibNowISO().slice(0, 10));
  const [historyType, setHistoryType] = useState<'all' | AttendanceType>('all');
  const [historyStatus, setHistoryStatus] = useState<'all' | 'normal' | 'late' | 'anomaly'>('all');
  const [historyMethod, setHistoryMethod] = useState<'all' | 'gps_self' | 'admin_qr'>('all');
  const [historyPage, setHistoryPage] = useState(1);

  // Selected Employee & Scan Details
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pin, setPin] = useState('');
  const [scanType, setScanType] = useState<AttendanceType>('masuk');
  
  // Status pembacaan GPS saat kirim scan
  const [isScanning, setIsScanning] = useState(false);
  const [showAssistedScan, setShowAssistedScan] = useState(false);
  const [assistedEmployee, setAssistedEmployee] = useState<Employee | null>(null);
  const [assistanceReason, setAssistanceReason] = useState('GPS karyawan tidak tersedia');
  const [locationVerified, setLocationVerified] = useState(false);
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const [showWorkSettings, setShowWorkSettings] = useState(false);
  const [workSettings, setWorkSettings] = useState<WorkSettings>(() => dataStore.getWorkSettings());

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
    setWorkSettings(dataStore.getWorkSettings());
  };

  // Portal karyawan: kunci pilihan ke diri sendiri & paksa mode kiosk
  useEffect(() => {
    if (lockedEmployee) {
      setSelectedEmpId(lockedEmployee.id);
      setActiveMode('pola_a_kiosk');
    }
  }, [lockedEmployee]);

  useEffect(() => {
    if (lockedEmployee && openLocationScannerSignal) {
      setStatusMessage(null);
      setShowLocationScanner(true);
    }
  }, [lockedEmployee, openLocationScannerSignal]);

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

  const inferEmployeeScanType = (employeeId: string): AttendanceType | null => {
    const today = wibNowISO().slice(0, 10);
    const todayLogs = dataStore.getAttendance().filter(log => log.employee_id === employeeId && log.timestamp.slice(0, 10) === today);
    if (!todayLogs.some(log => log.type_scan === 'masuk')) return 'masuk';
    if (!todayLogs.some(log => log.type_scan === 'pulang')) return 'pulang';
    return null;
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
    const effectiveScanType = lockedEmployee ? inferEmployeeScanType(emp.id) : scanType;
    if (!effectiveScanType) {
      setStatusMessage({ text: 'Absensi hari ini sudah lengkap: masuk dan pulang sudah tercatat.', error: true });
      return;
    }

    if (lockedEmployee && !locationVerified) {
      setStatusMessage({ text: 'Scan QR lokasi pabrik terlebih dahulu sebelum absen.', error: true });
      return;
    }

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
            type_scan: effectiveScanType,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            selfie_url: '',
            device_token: deviceToken!,
            note: `Kiosk Terminal Scan (GPS perangkat, akurasi ±${Math.round(pos.coords.accuracy)} m)`,
            verification_method: 'gps_self'
          });

          // Launch Big Success Overlay (Auto disappears in 3 seconds)
          const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
          setSuccessOverlay({
            visible: true,
            employeeName: emp.name,
            type: effectiveScanType,
            status: result.status,
            distance: Math.round(result.distance_meters),
            time: nowStr
          });

          // Clear states for next check-in (portal karyawan tetap terkunci ke dirinya)
          setPin('');
          setLocationVerified(false);
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

  const handleLocationQr = (rawValue: string) => {
    if (rawValue !== `ARI-LOCATION:${workSettings.location_qr_token}`) {
      setStatusMessage({ text: 'QR lokasi tidak valid atau sudah diganti.', error: true });
      return;
    }
    setLocationVerified(true);
    setShowLocationScanner(false);
    setStatusMessage({ text: 'QR lokasi terverifikasi. Silakan lanjutkan absensi.', error: false });
  };

  const saveWorkSettings = () => {
    if (!workSettings.start_time || !workSettings.end_time || workSettings.end_time <= workSettings.start_time) return alert('Jam kerja tidak valid.');
    if (workSettings.half_day_max_hours <= 0) return alert('Batas setengah hari harus lebih dari nol.');
    const attendanceRadius = Math.round(Number(workSettings.attendance_radius_meters) || 0);
    if (attendanceRadius < 10) return alert('Radius absensi minimal 10 meter.');
    const updatedSettings = { ...workSettings, attendance_radius_meters: attendanceRadius };
    dataStore.setWorkSettings(updatedSettings);
    setWorkSettings(updatedSettings);
    dataStore.logAudit('update', 'work_settings', `Mengubah aturan kerja menjadi ${updatedSettings.start_time}-${updatedSettings.end_time} WIB, radius ${updatedSettings.attendance_radius_meters}m`);
    setShowWorkSettings(false);
  };

  const regenerateLocationQr = () => {
    if (!window.confirm('Ganti QR lokasi? QR cetak lama langsung tidak berlaku.')) return;
    const updated = { ...workSettings, location_qr_token: `ari-hq-${crypto.randomUUID()}` };
    setWorkSettings(updated);
    dataStore.setWorkSettings(updated);
    dataStore.logAudit('update', 'work_settings', 'Mengganti token QR lokasi absensi');
  };

  const printLocationQr = () => {
    document.body.classList.add('location-qr-printing');
    const cleanup = () => document.body.classList.remove('location-qr-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  };

  const handleEmployeeQr = (rawValue: string) => {
    const prefix = 'ARI-ATTENDANCE:';
    const token = rawValue.startsWith(prefix) ? rawValue.slice(prefix.length) : '';
    const employee = employees.find(item => item.attendance_qr_token === token);
    if (!employee) {
      setStatusMessage({ text: 'QR karyawan tidak valid atau sudah tidak berlaku.', error: true });
      return;
    }
    setAssistedEmployee(employee);
    setStatusMessage(null);
  };

  const submitAssistedAttendance = () => {
    if (!assistedEmployee || !assistanceReason.trim() || !assistingAdmin) return;
    try {
      const dept = dataStore.getDepartments().find(d => d.id === assistedEmployee.department_id);
      if (!dept) throw new Error('Lokasi departemen karyawan tidak ditemukan.');
      dataStore.recordAttendance({
        employee_id: assistedEmployee.id,
        timestamp: wibNowISO(),
        type_scan: scanType,
        latitude: dept.latitude,
        longitude: dept.longitude,
        selfie_url: '',
        device_token: `admin-assisted-${assistingAdmin.id}`,
        verification_method: 'admin_qr',
        assisted_by_id: assistingAdmin.id,
        assisted_by_name: assistingAdmin.name,
        assistance_reason: assistanceReason.trim(),
        note: `Absensi dibantu admin melalui QR pribadi. Alasan: ${assistanceReason.trim()}`
      });
      setStatusMessage({ text: `Absensi ${scanType} ${assistedEmployee.name} berhasil dicatat dengan bantuan ${assistingAdmin.name}.`, error: false });
      setAssistedEmployee(null);
      setShowAssistedScan(false);
      loadData();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Gagal mencatat absensi bantuan.', error: true });
    }
  };

  // Filter employees for the list view
  const filteredEmployees = employees
    .filter(emp =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const automaticScanType = lockedEmployee ? inferEmployeeScanType(lockedEmployee.id) : null;
  const departmentLabel = (departmentId: string) => departmentId === 'dept-eva-foam' ? 'Eva Foam' : departmentId === 'dept-konveksi' ? 'Konveksi' : departmentId;

  const todayWib = wibNowISO().slice(0, 10);
  const periodBounds = (() => {
    if (historyPeriod === 'custom') return { start: historyStart, end: historyEnd };
    if (historyPeriod === 'today') return { start: todayWib, end: todayWib };
    const today = new Date(`${todayWib}T00:00:00+07:00`);
    if (historyPeriod === 'week') {
      const day = today.getDay() || 7;
      const monday = new Date(today.getTime() - (day - 1) * 86400000);
      return { start: monday.toISOString().slice(0, 10), end: todayWib };
    }
    return { start: `${todayWib.slice(0, 7)}-01`, end: todayWib };
  })();

  const filteredHistory = [...attendanceLogs]
    .filter(log => {
      const date = log.timestamp.slice(0, 10);
      const matchesDate = date >= periodBounds.start && date <= periodBounds.end;
      const query = historySearch.trim().toLowerCase();
      const employee = employees.find(item => item.id === log.employee_id);
      const matchesSearch = !query || `${log.employee_name} ${employee?.username || ''}`.toLowerCase().includes(query);
      const matchesType = historyType === 'all' || log.type_scan === historyType;
      const matchesStatus = historyStatus === 'all' || (historyStatus === 'late' ? (log.late_minutes || 0) > 0 : log.status === historyStatus);
      const method = log.verification_method || 'gps_self';
      const matchesMethod = historyMethod === 'all' || method === historyMethod;
      return matchesDate && matchesSearch && matchesType && matchesStatus && matchesMethod;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const periodLogs = attendanceLogs.filter(log => {
    const date = log.timestamp.slice(0, 10);
    return date >= periodBounds.start && date <= periodBounds.end;
  });
  const todayLogs = attendanceLogs.filter(log => log.timestamp.slice(0, 10) === todayWib);
  const todayCheckInIds = new Set(todayLogs.filter(log => log.type_scan === 'masuk').map(log => log.employee_id));
  const todayCheckOutIds = new Set(todayLogs.filter(log => log.type_scan === 'pulang').map(log => log.employee_id));
  const notCheckedInToday = employees.filter(employee => !todayCheckInIds.has(employee.id));
  const notCheckedOutToday = employees.filter(employee => todayCheckInIds.has(employee.id) && !todayCheckOutIds.has(employee.id));
  const assistedPeriodLogs = periodLogs.filter(log => (log.verification_method || 'gps_self') === 'admin_qr');
  const latePeriodLogs = periodLogs.filter(log => (log.late_minutes || 0) > 0);
  const pendingAttendanceSync = (() => {
    try {
      return JSON.parse(localStorage.getItem('nxty_attendance_pending') || '[]') as Attendance[];
    } catch {
      return [] as Attendance[];
    }
  })();
  const employeeRecaps = employees.map(employee => {
    const logs = periodLogs.filter(log => log.employee_id === employee.id);
    const checkInLogs = logs.filter(log => log.type_scan === 'masuk');
    const checkOutLogs = logs.filter(log => log.type_scan === 'pulang');
    return {
      employee,
      hadir: new Set(checkInLogs.map(log => log.timestamp.slice(0, 10))).size,
      pulang: new Set(checkOutLogs.map(log => log.timestamp.slice(0, 10))).size,
      telat: logs.reduce((sum, log) => sum + (log.late_minutes || 0), 0),
      penggantiTelat: logs.reduce((sum, log) => sum + (log.late_compensation_minutes || 0), 0),
      lembur: logs.reduce((sum, log) => sum + (log.overtime_minutes || 0), 0),
      bantuanAdmin: logs.filter(log => (log.verification_method || 'gps_self') === 'admin_qr').length,
      terakhir: logs[0]?.timestamp || ''
    };
  }).filter(item => item.hadir > 0 || item.pulang > 0 || item.telat > 0 || item.bantuanAdmin > 0)
    .sort((a, b) => b.terakhir.localeCompare(a.terakhir));
  const historyPageSize = 50;
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const pagedHistory = filteredHistory.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);

  useEffect(() => { setHistoryPage(1); }, [historySearch, historyPeriod, historyStart, historyEnd, historyType, historyStatus, historyMethod]);

  const exportAttendanceCsv = () => {
    const rows = [['Tanggal', 'Waktu WIB', 'Nama', 'Jenis', 'Status', 'Terlambat (menit)', 'Pengganti Telat (menit)', 'Durasi Kerja (menit)', 'Porsi Hari', 'Lembur (menit)', 'Metode', 'Dibantu Oleh', 'Alasan']];
    filteredHistory.forEach(log => rows.push([log.timestamp.slice(0, 10), log.timestamp.slice(11, 16), log.employee_name, log.type_scan, log.status, String(log.late_minutes || 0), String(log.late_compensation_minutes || 0), String(log.worked_minutes || 0), String(log.work_fraction || ''), String(log.overtime_minutes || 0), log.verification_method || 'gps_self', log.assisted_by_name || '', log.assistance_reason || '']));
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Riwayat_Absensi_${periodBounds.start}_sd_${periodBounds.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Stats calculation for Pola B Dashboard
  const stats = {
    totalKaryawan: employees.length,
    hadirHariIni: attendanceLogs.filter(l => l.timestamp.slice(0, 10) === todayWib && l.type_scan === 'masuk').length,
    anomaliHariIni: attendanceLogs.filter(l => l.timestamp.slice(0, 10) === todayWib && l.status === 'anomaly').length,
    pulangHariIni: attendanceLogs.filter(l => l.timestamp.slice(0, 10) === todayWib && l.type_scan === 'pulang').length
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. SELECTION BAR (POLA CONTROL TOGGLE) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5 no-print">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-[var(--color-evergreen)] rounded-lg">
              <Clock className="w-5 h-5" />
            </span>
            Sistem Absensi Karyawan
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Verifikasi absensi dengan PIN, QR lokasi, dan GPS sesuai radius yang diatur admin.</p>
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
                ? 'bg-[var(--color-evergreen)] text-white shadow-sm' 
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
                ? 'bg-[var(--color-evergreen)] text-white shadow-sm' 
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
      {isAdmin && (
        <div className="no-print bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold text-amber-950 flex items-center gap-2"><QrCode className="w-4 h-4" /> Absensi Dibantu Admin</p>
            <p className="text-xs text-amber-800 mt-1">Gunakan hanya jika GPS karyawan bermasalah. Identitas admin dan alasan akan tersimpan pada riwayat.</p>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowWorkSettings(true)} className="shrink-0 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"><Settings className="w-3.5 h-3.5 inline mr-1" /> Jam Kerja & QR Lokasi</button><button type="button" onClick={() => { setShowAssistedScan(true); setAssistedEmployee(null); }} className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Scan QR Karyawan</button></div>
        </div>
      )}

      {lockedEmployee && <div className={`no-print rounded-2xl border p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between ${locationVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-sky-50 border-sky-200'}`}><div><p className={`text-sm font-extrabold ${locationVerified ? 'text-emerald-900' : 'text-sky-900'}`}><QrCode className="w-4 h-4 inline mr-1" /> {locationVerified ? 'Lokasi Terverifikasi' : 'Scan QR Lokasi Pabrik'}</p><p className="text-xs text-gray-600 mt-1">QR lokasi wajib dipindai sebelum mengirim absensi.</p></div><button type="button" onClick={() => setShowLocationScanner(true)} className="bg-[var(--color-evergreen)] text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">{locationVerified ? 'Scan Ulang' : 'Buka Kamera QR'}</button></div>}

      {showLocationScanner && <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center no-print"><div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4"><div className="flex justify-between"><div><h3 className="font-black">Scan QR Lokasi</h3><p className="text-xs text-gray-500">Arahkan kamera ke QR yang ditempel di pabrik.</p></div><button onClick={() => setShowLocationScanner(false)} className="cursor-pointer"><X className="w-4 h-4" /></button></div><EmployeeQrScanner onScan={handleLocationQr} /></div></div>}

      {showWorkSettings && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center no-print">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[94vh] overflow-y-auto p-5 space-y-4">
            <div className="flex justify-between">
              <div><h3 className="font-black text-gray-900">Jam Kerja & QR Lokasi</h3><p className="text-xs text-gray-500">Seluruh waktu menggunakan WIB (GMT+7).</p></div>
              <button onClick={() => setShowWorkSettings(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-bold">Jam Masuk</label><input type="time" value={workSettings.start_time} onChange={e => setWorkSettings({...workSettings, start_time:e.target.value})} className="w-full mt-1 border rounded-lg p-2" /></div>
              <div><label className="text-xs font-bold">Jam Pulang</label><input type="time" value={workSettings.end_time} onChange={e => setWorkSettings({...workSettings, end_time:e.target.value})} className="w-full mt-1 border rounded-lg p-2" /></div>
              <div><label className="text-xs font-bold">Batas Setengah Hari (jam)</label><input type="number" min="1" step="0.5" value={workSettings.half_day_max_hours || ''} onChange={e => setWorkSettings({...workSettings, half_day_max_hours:Number(e.target.value)})} className="w-full mt-1 border rounded-lg p-2" /></div>
              <div><label className="text-xs font-bold">Radius Absensi (meter)</label><input type="number" min="10" step="5" value={workSettings.attendance_radius_meters || ''} onChange={e => setWorkSettings({...workSettings, attendance_radius_meters:Number(e.target.value)})} className="w-full mt-1 border rounded-lg p-2" /></div>
              <div><label className="text-xs font-bold">Bonus Rajin Bulanan</label><input type="number" min="0" value={workSettings.monthly_bonus_amount || ''} onChange={e => setWorkSettings({...workSettings, monthly_bonus_amount:Number(e.target.value)})} className="w-full mt-1 border rounded-lg p-2" /></div>
              <div><label className="text-xs font-bold">Minimum Kehadiran Bonus (hari)</label><input type="number" min="1" value={workSettings.monthly_bonus_min_days || ''} onChange={e => setWorkSettings({...workSettings, monthly_bonus_min_days:Number(e.target.value)})} className="w-full mt-1 border rounded-lg p-2" /></div>
            </div>
            <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-2">Jika lokasi karyawan lebih jauh dari radius ini, absensi akan ditolak dan tidak tersimpan.</p>
            <div className="location-qr-print-card border rounded-2xl p-4 text-center space-y-3"><p className="font-black">QR LOKASI ABSENSI · {brandName()}</p><div className="inline-flex bg-white p-2"><QRCodeSVG value={`ARI-LOCATION:${workSettings.location_qr_token}`} size={220} level="H" /></div><p className="text-xs">Scan QR ini melalui menu Absensi pada akun karyawan.</p></div>
            <div className="flex flex-wrap gap-2"><button onClick={regenerateLocationQr} className="px-3 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold cursor-pointer">Ganti QR Lokasi</button><button onClick={printLocationQr} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold cursor-pointer"><Printer className="w-3.5 h-3.5 inline mr-1" /> Cetak QR</button><button onClick={saveWorkSettings} className="ml-auto px-4 py-2 bg-[var(--color-evergreen)] text-white rounded-lg text-xs font-bold cursor-pointer">Simpan Pengaturan</button></div>
          </div>
        </div>
      )}

      {showAssistedScan && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center no-print">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div><h3 className="font-black text-gray-900">Scan QR Pribadi Karyawan</h3><p className="text-xs text-gray-500">Petugas: {assistingAdmin?.name || 'Identitas admin tidak tersedia'}</p></div>
              <button type="button" onClick={() => setShowAssistedScan(false)} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            {!assistedEmployee ? <EmployeeQrScanner onScan={handleEmployeeQr} /> : (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-[10px] uppercase font-bold text-emerald-600">QR Terverifikasi</p>
                <p className="font-black text-emerald-950">{assistedEmployee.name}</p>
                <p className="text-xs text-emerald-700">@{assistedEmployee.username}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(['masuk', 'pulang'] as AttendanceType[]).map(type => <button key={type} type="button" onClick={() => setScanType(type)} className={`py-2 rounded-lg text-xs font-bold uppercase border cursor-pointer ${scanType === type ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)]' : 'bg-white text-gray-600 border-gray-200'}`}>{type}</button>)}
            </div>
            <div><label className="text-xs font-bold text-gray-700">Alasan bantuan</label><textarea value={assistanceReason} onChange={e => setAssistanceReason(e.target.value)} rows={2} className="mt-1 w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-600" /></div>
            <button type="button" disabled={!assistedEmployee || !assistanceReason.trim() || !assistingAdmin} onClick={submitAssistedAttendance} className="w-full py-3 rounded-xl bg-[var(--color-evergreen)] disabled:bg-gray-300 text-white text-xs font-black uppercase cursor-pointer disabled:cursor-not-allowed">Konfirmasi Absensi Dibantu Admin</button>
          </div>
        </div>
      )}

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
              className="w-full bg-[var(--color-evergreen)] text-white text-xs py-2.5 rounded-xl font-bold hover:bg-opacity-95"
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
                <HelpCircle className="w-5 h-5 text-[var(--color-evergreen)]" />
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
                <MapPin className="w-4 h-4 text-[var(--color-evergreen)]" /> Verifikasi Lokasi GPS
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Lokasi diambil otomatis dari <b>GPS perangkat ini</b> saat tombol absen ditekan.
                Jika posisi berada di luar radius yang ditentukan admin, absensi akan ditolak.
              </p>
              <p className="text-[10px] text-gray-400">
                Pastikan GPS aktif dan izinkan akses lokasi saat browser meminta. Jaga kerahasiaan PIN Anda.
              </p>
            </div>
          </div>

          {/* RIGHT SIDE: INTERACTIVE TOUCH KIOSK (8 Columns on Desktop) */}
          <div className="lg:col-span-8 bg-[#122F21] rounded-3xl border border-[var(--color-evergreen-dark)] shadow-xl overflow-hidden text-left text-white">
            
            {/* Header Kiosk */}
            <div className="bg-[var(--color-evergreen)] px-6 py-5 border-b border-[var(--color-evergreen-dark)] flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-800/40 border border-emerald-600/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight text-white uppercase">Absensi {brandName()}</h3>
                  <p className="text-[10px] text-emerald-200/80 font-medium">Scan QR lokasi untuk masuk dan pulang kerja</p>
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
                  <div className="bg-[var(--color-evergreen-dark)] border border-amber-400/40 rounded-2xl p-4 flex items-center gap-3">
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
                    className="w-full bg-[var(--color-evergreen-dark)] border border-[#235339] text-white placeholder-emerald-200/50 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-medium transition-all"
                  />
                </div>

                {/* Employees Touch-Friendly Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto scrollbar-none pr-1">
                  {filteredEmployees.length === 0 ? (
                    <div className="col-span-2 text-center py-10 text-xs text-emerald-200/50 italic bg-[var(--color-evergreen-dark)]/40 rounded-xl">
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
                              ? 'bg-[var(--color-evergreen)] border-amber-400 text-white shadow-md shadow-black/20 ring-1 ring-amber-400'
                              : 'bg-[var(--color-evergreen-dark)]/60 border-[#1c4731] hover:bg-[var(--color-evergreen-dark)] hover:border-[#24593e] text-emerald-100'
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
                  <h4 className="text-xs font-black uppercase text-emerald-300 tracking-wider">{lockedEmployee ? 'Jenis Absensi Otomatis' : 'Langkah 2: Pilih Tipe Scan'}</h4>
                  {lockedEmployee ? (
                    <div className={`rounded-xl border p-4 text-center ${automaticScanType === 'masuk' ? 'bg-emerald-950/50 border-emerald-600/40' : automaticScanType === 'pulang' ? 'bg-rose-950/30 border-rose-600/40' : 'bg-gray-900/40 border-gray-600/40'}`}>
                      <p className="text-[10px] uppercase tracking-wider text-emerald-300">Scan berikutnya tercatat sebagai</p>
                      <p className="text-lg font-black uppercase mt-1">{automaticScanType || 'Sudah Lengkap'}</p>
                      <p className="text-[10px] text-emerald-200/60 mt-1">Scan pertama = masuk, scan kedua = pulang.</p>
                    </div>
                  ) : <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setScanType('masuk')}
                      className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                        scanType === 'masuk'
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-black/10'
                          : 'bg-[var(--color-evergreen-dark)]/40 border-[#1d4631] text-emerald-200/70 hover:bg-[var(--color-evergreen-dark)]'
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
                          : 'bg-[var(--color-evergreen-dark)]/40 border-[#1d4631] text-emerald-200/70 hover:bg-[var(--color-evergreen-dark)]'
                      }`}
                    >
                      <Clock className="w-4 h-4 shrink-0 text-rose-400" />
                      Scan Pulang Kerja
                    </button>
                  </div>}
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
                      className="h-11 rounded-xl bg-[var(--color-evergreen-dark)]/75 hover:bg-[#1f4b36] text-white text-base font-extrabold border border-[#1c4731] transition-all cursor-pointer active:scale-95 flex items-center justify-center shadow-xs"
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
                    className="h-11 rounded-xl bg-[var(--color-evergreen-dark)]/75 hover:bg-[#1f4b36] text-white text-base font-extrabold border border-[#1c4731] transition-all cursor-pointer active:scale-95 flex items-center justify-center shadow-xs"
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
                  disabled={!selectedEmpId || (!!lockedEmployee && (!locationVerified || !automaticScanType)) || (!lockedEmployee && pin.length < 4) || isScanning}
                  className={`w-full py-3.5 rounded-xl text-xs uppercase font-extrabold tracking-widest flex items-center justify-center gap-2 border transition-all ${
                    (!selectedEmpId || (!!lockedEmployee && (!locationVerified || !automaticScanType)) || (!lockedEmployee && pin.length < 4) || isScanning)
                      ? 'bg-emerald-950/60 border-emerald-900/40 text-emerald-200/30 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-transparent shadow-md active:scale-[0.98] cursor-pointer'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  {isScanning ? 'MEMBACA LOKASI GPS…' : lockedEmployee && automaticScanType ? `KIRIM ABSEN ${automaticScanType.toUpperCase()}` : 'KIRIM SCAN ABSENSI'}
                </button>
              </div>

            </div>

            {/* Bottom Info bar */}
            <div className="bg-[#0e2419] px-6 py-3 border-t border-[var(--color-evergreen-dark)] text-[10px] text-emerald-300/60 flex flex-col sm:flex-row justify-between items-center gap-2 font-mono">
              <span>Radius absensi: {workSettings.attendance_radius_meters} m</span>
              <span>{brandName()}</span>
            </div>

          </div>

        </div>

      ) : (

        /* -------------------------------------------------------------
           POLA B: REAL-TIME MONITORING HRD (Admin Recap & Logs)
           ------------------------------------------------------------- */
        <div className="space-y-6">
          <div className="bg-white p-1 rounded-xl border border-gray-200 inline-flex flex-wrap gap-1 no-print">
            {([
              { id: 'summary', label: 'Ringkasan' },
              { id: 'recap', label: 'Rekap Karyawan' },
              { id: 'history', label: 'Riwayat Scan' },
              { id: 'correction', label: 'Koreksi' },
              { id: 'sync', label: 'Sync' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAdminAttendanceTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer ${adminAttendanceTab === tab.id ? 'bg-[var(--color-evergreen)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-2 no-print">
            <div className="flex flex-wrap gap-2">
              {(['today', 'week', 'month', 'custom'] as const).map(period => <button key={period} onClick={() => setHistoryPeriod(period)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer border ${historyPeriod === period ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)]' : 'bg-white text-gray-600 border-gray-200'}`}>{period === 'today' ? 'Hari Ini' : period === 'week' ? 'Minggu Ini' : period === 'month' ? 'Bulan Ini' : 'Custom'}</button>)}
              <button onClick={exportAttendanceCsv} className="ml-auto px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 cursor-pointer"><Download className="w-3 h-3 inline mr-1" /> CSV</button>
            </div>
            {historyPeriod === 'custom' && <div className="grid grid-cols-2 gap-2 max-w-md"><input type="date" value={historyStart} onChange={e => setHistoryStart(e.target.value)} className="border border-gray-200 rounded-lg p-2 text-xs" /><input type="date" value={historyEnd} min={historyStart} onChange={e => setHistoryEnd(e.target.value)} className="border border-gray-200 rounded-lg p-2 text-xs" /></div>}
            <p className="text-[10px] text-gray-400">Periode analisa: {periodBounds.start} s/d {periodBounds.end}</p>
          </div>
          
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
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data Luar Radius Lama</p>
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

          {adminAttendanceTab === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs text-left">
                <div>
                  <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-2"><Calendar className="w-4 h-4 text-[var(--color-evergreen)]" /> Ringkasan Harian</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Tampilan cepat untuk kondisi absensi hari ini.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-black text-emerald-700 uppercase">Hadir</p><p className="text-xl font-black text-emerald-900">{todayCheckInIds.size}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-black text-slate-600 uppercase">Sudah Pulang</p><p className="text-xl font-black text-slate-900">{todayCheckOutIds.size}</p></div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-[10px] font-black text-amber-700 uppercase">Terlambat</p><p className="text-xl font-black text-amber-900">{todayLogs.filter(log => (log.late_minutes || 0) > 0).length}</p></div>
                  <div className="rounded-xl border border-rose-100 bg-rose-50 p-3"><p className="text-[10px] font-black text-rose-700 uppercase">Belum Masuk</p><p className="text-xl font-black text-rose-900">{notCheckedInToday.length}</p></div>
                  <div className="rounded-xl border border-sky-100 bg-sky-50 p-3"><p className="text-[10px] font-black text-sky-700 uppercase">Belum Pulang</p><p className="text-xl font-black text-sky-900">{notCheckedOutToday.length}</p></div>
                  <div className="rounded-xl border border-purple-100 bg-purple-50 p-3"><p className="text-[10px] font-black text-purple-700 uppercase">Dibantu Admin</p><p className="text-xl font-black text-purple-900">{todayLogs.filter(log => (log.verification_method || 'gps_self') === 'admin_qr').length}</p></div>
                </div>
              </div>
              <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs text-left">
                <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider">Perlu Perhatian</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {[...notCheckedInToday.slice(0, 8).map(emp => ({ name: emp.name, text: 'Belum absen masuk', tone: 'text-rose-700 bg-rose-50 border-rose-100' })),
                    ...notCheckedOutToday.slice(0, 8).map(emp => ({ name: emp.name, text: 'Belum absen pulang', tone: 'text-sky-700 bg-sky-50 border-sky-100' }))].map((item, index) => (
                    <div key={`${item.name}-${index}`} className={`rounded-lg border p-2.5 text-xs ${item.tone}`}><b>{item.name}</b><span className="ml-2">{item.text}</span></div>
                  ))}
                  {notCheckedInToday.length === 0 && notCheckedOutToday.length === 0 && <p className="text-xs text-gray-400 text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">Tidak ada catatan yang perlu perhatian hari ini.</p>}
                </div>
              </div>
            </div>
          )}

          {adminAttendanceTab === 'recap' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div><h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider">Rekap Per Karyawan</h3><p className="text-[10px] text-gray-400">Agregasi untuk analisa kedisiplinan dan payroll.</p></div>
                <div className="relative"><Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" /><input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Cari karyawan..." className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs" /></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500"><tr><th className="p-2 text-left">Karyawan</th><th className="p-2 text-left">Departemen</th><th className="p-2 text-right">Hadir</th><th className="p-2 text-right">Pulang</th><th className="p-2 text-right">Telat</th><th className="p-2 text-right">Pengganti</th><th className="p-2 text-right">Lembur</th><th className="p-2 text-right">Bantuan</th></tr></thead>
                  <tbody>{employeeRecaps.filter(item => !historySearch.trim() || `${item.employee.name} ${item.employee.username || ''}`.toLowerCase().includes(historySearch.trim().toLowerCase())).map(item => <tr key={item.employee.id} className="border-t border-gray-100"><td className="p-2 font-bold text-gray-800">{item.employee.name}<p className="text-[10px] text-gray-400 font-normal">@{item.employee.username}</p></td><td className="p-2">{departmentLabel(item.employee.department_id)}</td><td className="p-2 text-right font-mono font-black">{item.hadir}</td><td className="p-2 text-right font-mono">{item.pulang}</td><td className="p-2 text-right font-mono text-amber-700">{item.telat}m</td><td className="p-2 text-right font-mono text-emerald-700">{item.penggantiTelat}m</td><td className="p-2 text-right font-mono text-sky-700">{item.lembur}m</td><td className="p-2 text-right font-mono">{item.bantuanAdmin}</td></tr>)}{employeeRecaps.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-gray-400">Belum ada data pada periode ini.</td></tr>}</tbody>
                </table>
              </div>
            </div>
          )}

          {adminAttendanceTab === 'correction' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs text-left">
              <div><h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider">Koreksi & Bantuan Admin</h3><p className="text-[10px] text-gray-400">Daftar absensi yang dibuat lewat bantuan admin, lengkap dengan alasan.</p></div>
              <div className="space-y-2">{assistedPeriodLogs.length === 0 ? <p className="p-10 text-center text-xs text-gray-400 bg-gray-50 border border-dashed rounded-xl">Belum ada absensi dibantu admin pada periode ini.</p> : assistedPeriodLogs.map(log => <div key={log.id} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"><div><p className="font-black text-gray-900">{log.employee_name}</p><p className="text-gray-500">{log.timestamp.slice(0, 10)} · {log.timestamp.slice(11, 16)} · {log.type_scan}</p></div><span className="rounded-full bg-white border border-amber-200 px-2 py-1 text-[10px] font-black text-amber-800">Dibantu {log.assisted_by_name || '-'}</span></div><p className="mt-2 text-gray-600">Alasan: {log.assistance_reason || '-'}</p></div>)}</div>
            </div>
          )}

          {adminAttendanceTab === 'sync' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs text-left">
              <div><h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider">Monitoring Sync Absensi</h3><p className="text-[10px] text-gray-400">Memantau data absensi yang sudah tersimpan lokal dan antrean yang belum terkirim cloud.</p></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3"><p className="text-[10px] font-black uppercase text-emerald-700">Tersimpan Lokal</p><p className="text-xl font-black text-emerald-900">{attendanceLogs.length}</p></div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3"><p className="text-[10px] font-black uppercase text-amber-700">Menunggu Sync</p><p className="text-xl font-black text-amber-900">{pendingAttendanceSync.length}</p></div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3"><p className="text-[10px] font-black uppercase text-slate-600">Periode Aktif</p><p className="text-xl font-black text-slate-900">{periodLogs.length}</p></div>
              </div>
              <div className="space-y-2">{pendingAttendanceSync.length === 0 ? <p className="p-10 text-center text-xs text-gray-400 bg-gray-50 border border-dashed rounded-xl">Tidak ada antrean absensi pending di perangkat ini.</p> : pendingAttendanceSync.map(log => <div key={log.id} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs"><b>{log.employee_name}</b><span className="ml-2">{log.timestamp?.slice(0, 16)} · {log.type_scan}</span></div>)}</div>
            </div>
          )}

          {/* Grid Layout: Map Representation vs Raw Logs */}
          {adminAttendanceTab === 'history' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Box: Geofence Safe Zone Map Simulation (5 Columns) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs text-left no-print">
              <div>
                <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-2">
                  <Map className="w-4 h-4 text-[var(--color-evergreen)]" /> Radius Absensi Pabrik
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Absensi hanya diterima jika GPS berada dalam radius yang diatur admin.</p>
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
                  <div className="px-1.5 py-0.5 bg-rose-600 text-white font-mono text-[8px] rounded shadow-md">Di luar radius: ditolak</div>
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
                  <p className="text-emerald-400">&bull; Radius diterima: {workSettings.attendance_radius_meters}m</p>
                  <p className="text-rose-500">&bull; Di luar radius: ditolak</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-150 rounded-xl p-3 text-[11px] text-gray-500 leading-relaxed font-medium">
                <span className="font-bold text-gray-800 block mb-0.5">Keterangan Aturan Lokasi:</span>
                Setiap scan masuk/pulang karyawan dihitung jarak lurusnya ke koordinat pusat departemen pabrik. 
                Jika jarak melebihi <span className="font-bold text-gray-800">{workSettings.attendance_radius_meters} meter</span>, absensi ditolak dan tidak tersimpan.
              </div>
            </div>

            {/* Right Box: Detailed Raw Logs (7 Columns) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs text-left">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[var(--color-evergreen)]" /> Riwayat Log Absensi Lengkap
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Semua data scan absensi karyawan yang sudah tersimpan.</p>
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

              <div className="space-y-2 no-print">
                <div className="flex flex-wrap gap-2">
                  {(['today', 'week', 'month', 'custom'] as const).map(period => <button key={period} onClick={() => setHistoryPeriod(period)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer border ${historyPeriod === period ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)]' : 'bg-white text-gray-600 border-gray-200'}`}>{period === 'today' ? 'Hari Ini' : period === 'week' ? 'Minggu Ini' : period === 'month' ? 'Bulan Ini' : 'Custom'}</button>)}
                  <button onClick={exportAttendanceCsv} className="ml-auto px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 cursor-pointer"><Download className="w-3 h-3 inline mr-1" /> CSV</button>
                </div>
                {historyPeriod === 'custom' && <div className="grid grid-cols-2 gap-2"><input type="date" value={historyStart} onChange={e => setHistoryStart(e.target.value)} className="border border-gray-200 rounded-lg p-2 text-xs" /><input type="date" value={historyEnd} min={historyStart} onChange={e => setHistoryEnd(e.target.value)} className="border border-gray-200 rounded-lg p-2 text-xs" /></div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><div className="relative"><Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" /><input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Cari nama atau username..." className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs" /></div><div className="grid grid-cols-3 gap-1.5"><select value={historyType} onChange={e => setHistoryType(e.target.value as typeof historyType)} className="min-w-0 border border-gray-200 rounded-lg px-1.5 text-[10px]"><option value="all">Semua Scan</option><option value="masuk">Masuk</option><option value="pulang">Pulang</option></select><select value={historyStatus} onChange={e => setHistoryStatus(e.target.value as typeof historyStatus)} className="min-w-0 border border-gray-200 rounded-lg px-1.5 text-[10px]"><option value="all">Semua Status</option><option value="normal">Normal</option><option value="late">Terlambat</option><option value="anomaly">Anomali</option></select><select value={historyMethod} onChange={e => setHistoryMethod(e.target.value as typeof historyMethod)} className="min-w-0 border border-gray-200 rounded-lg px-1.5 text-[10px]"><option value="all">Semua Metode</option><option value="gps_self">GPS Karyawan</option><option value="admin_qr">Dibantu Admin</option></select></div></div>
                <p className="text-[10px] text-gray-400">Menampilkan {filteredHistory.length} log · {periodBounds.start} s/d {periodBounds.end}</p>
              </div>

              {/* Logs Stream Container */}
              <div className="space-y-3">
                {pagedHistory.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    Tidak ada data absensi yang cocok dengan filter saat ini.
                  </p>
                ) : (
                  pagedHistory.map((log) => {
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
                              {(log.late_minutes || 0) > 0 && <span className="font-bold text-amber-700">Terlambat {log.late_minutes} menit</span>}
                              {(log.late_compensation_minutes || 0) > 0 && <span className="font-bold text-emerald-700">Pengganti telat {log.late_compensation_minutes} menit</span>}
                              {log.work_fraction === 0.5 && <span className="font-bold text-rose-700">Setengah Hari</span>}
                              {(log.overtime_minutes || 0) > 0 && <span className="font-bold text-sky-700">Lembur {log.overtime_minutes} menit</span>}
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
              {historyTotalPages > 1 && <div className="flex items-center justify-between pt-2 border-t border-gray-100 no-print"><button disabled={historyPage === 1} onClick={() => setHistoryPage(page => Math.max(1, page - 1))} className="p-2 border rounded-lg disabled:opacity-30 cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" /></button><span className="text-[10px] text-gray-500">Halaman {historyPage} dari {historyTotalPages}</span><button disabled={historyPage === historyTotalPages} onClick={() => setHistoryPage(page => Math.min(historyTotalPages, page + 1))} className="p-2 border rounded-lg disabled:opacity-30 cursor-pointer"><ChevronRight className="w-3.5 h-3.5" /></button></div>}
            </div>

          </div>}

        </div>

      )}

    </div>
  );
};
