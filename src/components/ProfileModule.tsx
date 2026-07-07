import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Employee, ProductionJob, ProductionTaskLog } from '../types';
import { dataStore, hashPin, wibNowISO, wibTodayStr } from '../dataStore';
import { Camera, ClipboardCheck, Eye, EyeOff, KeyRound, Phone, Printer, QrCode, Save, User } from 'lucide-react';

interface ProfileModuleProps {
  employee: Employee;
  onUpdated: (emp: Employee) => void;
}

// Halaman "Profil Saya" — setiap karyawan bisa memasang foto,
// memperbarui nomor HP, dan mengganti PIN sendiri.
export const ProfileModule: React.FC<ProfileModuleProps> = ({ employee, onUpdated }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [phone, setPhone] = useState(employee.phone_number || '');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [showAttendanceQr, setShowAttendanceQr] = useState(false);
  const [productionJobs, setProductionJobs] = useState<ProductionJob[]>([]);
  const [taskLogs, setTaskLogs] = useState<ProductionTaskLog[]>([]);
  const [taskJobId, setTaskJobId] = useState('');
  const [taskStage, setTaskStage] = useState('');
  const [taskName, setTaskName] = useState('');
  const [taskQtyDone, setTaskQtyDone] = useState(0);
  const [taskQtyRejected, setTaskQtyRejected] = useState(0);
  const [taskNotes, setTaskNotes] = useState('');

  const departments = dataStore.getDepartments();
  const deptName = departments.find(d => d.id === employee.department_id)?.name || 'Umum';

  const loadProductionTasks = () => {
    setProductionJobs(dataStore.getProductionJobs());
    setTaskLogs(dataStore.getProductionTaskLogs());
  };

  useEffect(() => {
    loadProductionTasks();
    const handleStorageChange = () => loadProductionTasks();
    window.addEventListener('nxty_storage_change', handleStorageChange);
    return () => window.removeEventListener('nxty_storage_change', handleStorageChange);
  }, [employee.id]);

  const assignedJobs = productionJobs.filter(job =>
    job.status !== 'completed' &&
    (
      job.assigned_employees?.some(item => item.employee_id === employee.id) ||
      (!job.assigned_employees?.length && job.department_id === employee.department_id)
    )
  );
  const selectedTaskJob = productionJobs.find(job => job.id === taskJobId);
  const myTodayTaskLogs = taskLogs.filter(log => log.employee_id === employee.id && log.date === wibTodayStr());

  const saveEmployee = (patch: Partial<Employee>, successText: string) => {
    const updated = dataStore.getEmployees().map(e =>
      e.id === employee.id ? { ...e, ...patch } : e
    );
    dataStore.setEmployees(updated);
    const fresh = updated.find(e => e.id === employee.id)!;
    onUpdated(fresh);
    setMessage({ text: successText, error: false });
  };

  // Unggah foto: dikecilkan ke 256x256 (crop tengah) lalu disimpan sebagai data URL
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      URL.revokeObjectURL(img.src);
      saveEmployee({ photo_url: dataUrl }, 'Foto profil berhasil diperbarui!');
    };
    img.onerror = () => setMessage({ text: 'File gambar tidak valid.', error: true });
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  const handleSavePhone = () => {
    saveEmployee({ phone_number: phone.trim() }, 'Nomor HP berhasil diperbarui!');
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!dataStore.verifyEmployeePin(employee.id, oldPin)) {
      setMessage({ text: 'PIN lama salah.', error: true });
      return;
    }
    if (newPin.length !== 4) {
      setMessage({ text: 'PIN baru harus 4 digit angka.', error: true });
      return;
    }
    if (newPin !== newPin2) {
      setMessage({ text: 'Konfirmasi PIN baru tidak sama.', error: true });
      return;
    }
    saveEmployee({ pin: hashPin(newPin), pin_hashed: true }, 'PIN berhasil diganti!');
    setOldPin('');
    setNewPin('');
    setNewPin2('');
  };

  const handlePrintQr = () => {
    if (!employee.attendance_qr_token) return;
    document.body.classList.add('qr-printing');
    const cleanup = () => document.body.classList.remove('qr-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  };

  const handleSubmitTaskLog = (e: React.FormEvent) => {
    e.preventDefault();
    const job = productionJobs.find(item => item.id === taskJobId);
    if (!job) {
      setMessage({ text: 'Pilih order produksi terlebih dahulu.', error: true });
      return;
    }
    const qtyDone = Math.max(0, Number(taskQtyDone) || 0);
    const qtyRejected = Math.max(0, Number(taskQtyRejected) || 0);
    if (qtyDone <= 0 && qtyRejected <= 0) {
      setMessage({ text: 'Isi minimal Qty Selesai atau Qty Reject lebih dari 0.', error: true });
      return;
    }
    const label = `${job.order_number || job.id} - ${job.product_name}`;
    dataStore.postProductionTaskLog({
      id: `ptask-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      production_job_id: job.id,
      production_label: label,
      employee_id: employee.id,
      employee_name: employee.name,
      date: wibTodayStr(),
      stage_name: taskStage || job.current_stage,
      task_name: taskName.trim() || taskStage || job.current_stage,
      qty_done: qtyDone,
      qty_rejected: qtyRejected,
      notes: taskNotes.trim() || undefined,
      created_at: wibNowISO()
    });
    setTaskName('');
    setTaskQtyDone(0);
    setTaskQtyRejected(0);
    setTaskNotes('');
    loadProductionTasks();
    setMessage({ text: 'Kerjaan harian produksi berhasil dicatat.', error: false });
  };

  const handleDeleteTaskLog = (logId: string) => {
    if (!window.confirm('Hapus catatan kerjaan ini?')) return;
    if (!dataStore.deleteProductionTaskLog(logId)) {
      setMessage({ text: 'Catatan kerja tidak ditemukan.', error: true });
      return;
    }
    loadProductionTasks();
    setMessage({ text: 'Catatan kerja berhasil dihapus.', error: false });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Kartu identitas */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col sm:flex-row items-center gap-5">
        <div className="relative shrink-0">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-[#1F4B36] flex items-center justify-center border-4 border-emerald-100">
            {employee.photo_url ? (
              <img src={employee.photo_url} alt={employee.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-amber-400">{employee.name[0]}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            title="Ganti foto profil"
            className="absolute -bottom-1 -right-1 bg-[#1F4B36] hover:bg-[#163826] text-white p-2 rounded-full border-2 border-white cursor-pointer transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
        </div>
        <div className="text-center sm:text-left min-w-0">
          <h2 className="text-xl font-bold text-gray-800 truncate">{employee.name}</h2>
          <p className="text-sm text-gray-500 font-mono">@{employee.username}</p>
          <div className="flex flex-wrap gap-1.5 mt-2 justify-center sm:justify-start">
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded text-xs font-semibold">{deptName}</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded text-xs font-semibold capitalize">{employee.role}</span>
          </div>
        </div>
      </div>

      {message && (
        <p className={`text-sm rounded-lg p-3 text-center border ${
          message.error
            ? 'text-rose-700 bg-rose-50 border-rose-100'
            : 'text-emerald-700 bg-emerald-50 border-emerald-100'
        }`}>
          {message.text}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Nomor HP */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#1F4B36]" /> Nomor HP / WhatsApp
          </h3>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1F4B36]"
          />
          <button
            onClick={handleSavePhone}
            className="bg-[#1F4B36] hover:bg-[#163826] text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Simpan
          </button>
        </div>

        {/* Ganti PIN */}
        <form onSubmit={handleChangePin} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#1F4B36]" /> Ganti PIN Login
          </h3>
          <input
            type="password" inputMode="numeric" maxLength={4} placeholder="PIN lama"
            value={oldPin} onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1F4B36]"
          />
          <input
            type="password" inputMode="numeric" maxLength={4} placeholder="PIN baru (4 digit)"
            value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1F4B36]"
          />
          <input
            type="password" inputMode="numeric" maxLength={4} placeholder="Ulangi PIN baru"
            value={newPin2} onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1F4B36]"
          />
          <button
            type="submit"
            disabled={!oldPin || !newPin || !newPin2}
            className={`text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 ${
              !oldPin || !newPin || !newPin2
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#1F4B36] hover:bg-[#163826] text-white cursor-pointer'
            }`}
          >
            <User className="w-4 h-4" /> Ganti PIN
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-[#1F4B36]" /> Kerjaan Harian Produksi</h3>
          <p className="text-xs text-gray-500 mt-1">Catatan ini hanya untuk progres kerja produksi dan tidak mengubah perhitungan gaji.</p>
        </div>

        <form onSubmit={handleSubmitTaskLog} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Order Produksi</label>
            <select
              value={taskJobId}
              onChange={event => {
                const job = productionJobs.find(item => item.id === event.target.value);
                setTaskJobId(event.target.value);
                setTaskStage(job?.current_stage || '');
                setTaskName(job?.current_stage || '');
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1F4B36]"
            >
              <option value="">Pilih tugas produksi</option>
              {assignedJobs.map(job => <option key={job.id} value={job.id}>{job.order_number || job.id} - {job.product_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Tahap</label>
            <select value={taskStage} onChange={event => setTaskStage(event.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm">
              <option value="">Pilih tahap</option>
              {(selectedTaskJob?.stages || []).map(stage => <option key={stage.stage} value={stage.stage}>{stage.stage}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Kerjaan</label>
            <input value={taskName} onChange={event => setTaskName(event.target.value)} placeholder="Contoh: jahit pinggir" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm" />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Qty Selesai</label>
            <input type="number" min={0} value={taskQtyDone} onChange={event => setTaskQtyDone(Number(event.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-mono font-bold" />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Qty Reject</label>
            <input type="number" min={0} value={taskQtyRejected} onChange={event => setTaskQtyRejected(Number(event.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-mono font-bold" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Catatan</label>
            <textarea value={taskNotes} onChange={event => setTaskNotes(event.target.value)} rows={2} placeholder="Catatan kendala, ukuran, warna, atau detail kerja hari ini" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm" />
          </div>

          <button type="submit" disabled={!taskJobId} className={`md:col-span-2 text-sm font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 ${!taskJobId ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#1F4B36] hover:bg-[#163826] text-white cursor-pointer'}`}>
            <Save className="w-4 h-4" /> Simpan Kerjaan Hari Ini
          </button>
        </form>

        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-wide">Riwayat Hari Ini</p>
          {myTodayTaskLogs.length === 0 ? (
            <p className="text-xs text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4 text-center">Belum ada pekerjaan produksi yang dicatat hari ini.</p>
          ) : myTodayTaskLogs.map(log => (
            <div key={log.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs flex justify-between gap-3">
              <div>
                <p className="font-bold text-gray-800">{log.task_name}</p>
                <p className="text-[10px] text-gray-500">{log.production_label} · {log.stage_name}</p>
                {log.notes && <p className="text-[10px] text-gray-500 mt-1">{log.notes}</p>}
              </div>
              <div className="text-right font-mono shrink-0">
                <p className="font-black text-emerald-700">{log.qty_done} selesai</p>
                {log.qty_rejected > 0 && <p className="font-bold text-rose-600">{log.qty_rejected} reject</p>}
                <button type="button" onClick={() => handleDeleteTaskLog(log.id)} className="mt-2 text-[10px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR pribadi hanya untuk identifikasi saat absensi dibantu admin. */}
      <div className="qr-print-card bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div>
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><QrCode className="w-4 h-4 text-[#1F4B36]" /> QR Absensi Saya</h3>
            <p className="text-xs text-gray-500 mt-1">Tunjukkan kepada admin hanya saat absensi bantuan diperlukan.</p>
          </div>
          {employee.attendance_qr_token && <button type="button" onClick={() => setShowAttendanceQr(value => !value)} className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">{showAttendanceQr ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}{showAttendanceQr ? 'Sembunyikan QR' : 'Tampilkan QR'}</button>}
        </div>

        {!employee.attendance_qr_token ? <p className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">QR belum tersedia. Silakan hubungi owner untuk memperbarui akun.</p> : showAttendanceQr ? (
          <div className="mt-5 flex flex-col items-center text-center gap-3">
            <div className="bg-white p-3 border border-gray-200 rounded-xl shadow-sm"><QRCodeSVG value={`ARI-ATTENDANCE:${employee.attendance_qr_token}`} size={220} level="H" /></div>
            <div><p className="font-black text-gray-900">{employee.name}</p><p className="text-xs text-gray-500 font-mono">@{employee.username} · {deptName}</p></div>
            <p className="max-w-sm text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 no-print">QR ini bersifat pribadi. Jangan dikirim atau dipinjamkan kepada orang lain. Hubungi owner jika QR diduga bocor.</p>
            <button type="button" onClick={handlePrintQr} className="no-print px-4 py-2 rounded-lg bg-[#1F4B36] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Printer className="w-3.5 h-3.5" /> Cetak Kartu QR</button>
          </div>
        ) : <div className="mt-4 p-5 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center no-print"><QrCode className="w-8 h-8 mx-auto text-gray-300" /><p className="text-xs text-gray-400 mt-2">QR disembunyikan untuk keamanan.</p></div>}
      </div>
    </div>
  );
};
