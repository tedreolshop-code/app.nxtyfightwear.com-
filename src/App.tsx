/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserRole, Employee, ProductionHandoff, ProductionJob, PackingTask } from './types';
import { dataStore, wibTodayStr } from './dataStore';
import { isCloudEnabled, getCloudStatus, CloudStatus } from './cloudSync';
import { MainDashboard } from './components/MainDashboard';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { AttendanceModule } from './components/AttendanceModule';
import { AuditRecycleModule } from './components/AuditRecycleModule';
import { PayrollModule } from './components/PayrollModule';
import { ProductionInventoryModule } from './components/ProductionInventoryModule';
import { WarehouseInventoryModule } from './components/WarehouseInventoryModule';
import { MarketplaceSalesModule } from './components/MarketplaceSalesModule';
import { PurchasesExpensesModule } from './components/PurchasesExpensesModule';
import { OrderModule } from './components/OrderModule';
import { EmployeeModule } from './components/EmployeeModule';
import { ProfileModule } from './components/ProfileModule';
import { CashAdvanceModule } from './components/CashAdvanceModule';
import {
  Users,
  FileText,
  Hammer,
  ShoppingBag,
  Download,
  Lock,
  Archive,
  LayoutDashboard,
  ShoppingCart,
  FileSpreadsheet,
  Activity,
  LogOut,
  User,
  ShieldCheck,
} from 'lucide-react';

// 4 role aktif (label disederhanakan; id tetap kompatibel dengan modul lama)
const ACTIVE_ROLES: Array<{ id: UserRole; label: string; desc: string }> = [
  { id: 'owner', label: 'Owner / Super Admin', desc: 'Akses penuh semua menu & laporan' },
  { id: 'admin_penjualan', label: 'Admin', desc: 'Input PO/pembelian, penjualan marketplace & non-marketplace, pengeluaran harian' },
  { id: 'admin_gudang', label: 'Gudang & Produksi', desc: 'Stok bahan baku & produk jadi, update tahapan produksi Eva Foam & Konveksi' },
  { id: 'karyawan', label: 'Karyawan', desc: 'Absensi dan slip gaji pribadi (login PIN)' },
];

// Menu datar — tanpa grup, tanpa akordion
const MENUS: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: UserRole[] }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'admin_penjualan', 'admin_gudang', 'karyawan'] },
  { id: 'penjualan', label: 'Penjualan', icon: ShoppingBag, roles: ['owner', 'admin_penjualan'] },
  { id: 'pembelian', label: 'Pembelian & Pengeluaran', icon: ShoppingCart, roles: ['owner', 'admin_penjualan'] },
  { id: 'gudang', label: 'Gudang', icon: Archive, roles: ['owner', 'admin_gudang'] },
  { id: 'produksi', label: 'Produksi', icon: Hammer, roles: ['owner', 'admin_gudang', 'karyawan'] },
  { id: 'karyawan', label: 'Karyawan', icon: Users, roles: ['owner'] },
  { id: 'laporan', label: 'Laporan', icon: FileSpreadsheet, roles: ['owner'] },
  // Semua orang adalah karyawan dengan akun sendiri — absensi & slip gaji terbuka untuk semua role
  { id: 'absensi', label: 'Absensi', icon: Activity, roles: ['owner', 'admin_penjualan', 'admin_gudang', 'karyawan'] },
  { id: 'gaji', label: 'Slip Gaji', icon: FileText, roles: ['owner', 'admin_penjualan', 'admin_gudang', 'karyawan'] },
  { id: 'profil', label: 'Profil Saya', icon: User, roles: ['owner', 'admin_penjualan', 'admin_gudang', 'karyawan'] },
  { id: 'audit', label: 'Audit & Recycle Bin', icon: ShieldCheck, roles: ['owner'] },
];

// Kartu login: username + PIN (satu pintu untuk semua akses)
function KaryawanLoginCard({ onLogin }: { onLogin: (emp: Employee) => void }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const emp = dataStore.verifyLogin(username, pin);
    if (!emp) {
      dataStore.logAudit('login', 'session', `Login gagal untuk username ${username.trim().toLowerCase() || '(kosong)'}`, undefined, { success: false });
      setError('Username atau PIN salah.');
      setPin('');
      return;
    }
    onLogin(emp);
  };

  return (
    <div className="max-w-sm mx-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 shadow-sm">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-full bg-[#1F4B36] text-amber-400 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-[#1F4B36]">Masuk</h2>
          <p className="text-sm text-gray-500">Masukkan username dan PIN Anda.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700 block">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(''); }}
            autoComplete="username"
            autoCapitalize="none"
            placeholder="username"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1F4B36]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700 block">PIN (4 digit)</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
            placeholder="••••"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center text-xl tracking-[0.5em] font-mono focus:outline-none focus:ring-1 focus:ring-[#1F4B36]"
          />
        </div>

        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={!username.trim() || pin.length < 4}
          className={`w-full py-3 rounded-lg text-sm font-bold transition-colors ${
            !username.trim() || pin.length < 4
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-[#1F4B36] hover:bg-[#163826] text-white cursor-pointer'
          }`}
        >
          Masuk
        </button>
      </form>
    </div>
  );
}

// Sesi login yang tersimpan di localStorage (bertahan saat refresh)
interface Session {
  role: UserRole;
  name: string;
  employeeId?: string; // hanya untuk role karyawan
}
const SESSION_KEY = 'nxty_session';

// Ubah data karyawan menjadi sesi sesuai akses sistem di profilnya
const sessionForEmployee = (emp: Employee): Session => ({
  role: emp.access_role || 'karyawan',
  name: emp.name,
  employeeId: emp.id,
});

// Halaman login penuh — SATU pintu untuk semua orang (nama + PIN);
// menu yang terbuka mengikuti akses sistem di profil masing-masing karyawan.
function LoginPage({ onLogin }: { onLogin: (s: Session, emp?: Employee) => void }) {
  return (
    <div className="min-h-screen w-full bg-[#1F4B36] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-white tracking-tight">ARI SPORTINDO</h1>
          <p className="text-emerald-200/80 text-sm">Sistem Produksi &amp; Manajemen</p>
        </div>

        <KaryawanLoginCard onLogin={(emp) => onLogin(sessionForEmployee(emp), emp)} />

        <p className="text-center text-emerald-200/50 text-xs">
          &copy; {new Date().getFullYear()} ARI SPORTINDO Production System
        </p>
      </div>
    </div>
  );
}

export default function App() {
  // Sesi login (dipulihkan dari localStorage saat refresh)
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  });
  const currentRole: UserRole = session?.role ?? 'owner';

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loggedEmployee, setLoggedEmployee] = useState<Employee | null>(() => {
    // Pulihkan karyawan yang login dari sesi tersimpan
    try {
      const s: Session | null = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (s?.employeeId) {
        return dataStore.getEmployees().find(e => e.id === s.employeeId) || null;
      }
    } catch { /* abaikan sesi rusak */ }
    return null;
  });

  const handleLogin = (s: Session, emp?: Employee) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
    if (emp) setLoggedEmployee(emp);
    dataStore.logAudit('login', 'session', `Login berhasil sebagai ${s.name}`, s.employeeId);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    dataStore.logAudit('logout', 'session', `Logout akun ${session?.name || 'pengguna'}`, session?.employeeId);
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setLoggedEmployee(null);
    setActiveTab('dashboard');
  };
  const [formattedTime, setFormattedTime] = useState('');
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(getCloudStatus());
  const [toast, setToast] = useState<string | null>(null);
  const [handoffPopup, setHandoffPopup] = useState<ProductionHandoff | null>(null);
  const [productionTaskPopup, setProductionTaskPopup] = useState<ProductionJob | null>(null);
  const [packingTaskPopup, setPackingTaskPopup] = useState<PackingTask | null>(null);
  const [openLocationScannerSignal, setOpenLocationScannerSignal] = useState(0);
  const productionTaskSeenKey = (employeeId: string, jobId: string) => `nxty_production_task_seen_${employeeId}_${jobId}_${wibTodayStr()}`;
  const packingTaskSeenKey = (employeeId: string, taskId: string) => `nxty_packing_task_seen_${employeeId}_${taskId}_${wibTodayStr()}`;

  useEffect(() => {
    const checkPendingHandoff = () => {
      if (!loggedEmployee) return setHandoffPopup(null);
      const pending = dataStore.getProductionHandoffs().find(item => item.status === 'pending' && item.to_employee_id === loggedEmployee.id && localStorage.getItem(`nxty_handoff_seen_${item.id}`) !== '1');
      setHandoffPopup(pending || null);
    };
    checkPendingHandoff();
    window.addEventListener('nxty_storage_change', checkPendingHandoff);
    return () => window.removeEventListener('nxty_storage_change', checkPendingHandoff);
  }, [loggedEmployee]);

  useEffect(() => {
    const checkProductionTasks = () => {
      if (!loggedEmployee || currentRole !== 'karyawan') {
        setProductionTaskPopup(null);
        setPackingTaskPopup(null);
        return;
      }
      const task = dataStore.getProductionJobs().find(job =>
        job.status !== 'completed' &&
        (
          job.assigned_employees?.some(item => item.employee_id === loggedEmployee.id) ||
          (!job.assigned_employees?.length && job.department_id === loggedEmployee.department_id)
        ) &&
        localStorage.getItem(productionTaskSeenKey(loggedEmployee.id, job.id)) !== '1'
      );
      setProductionTaskPopup(task || null);
      const packing = dataStore.getPackingTasks().find(task =>
        task.status === 'assigned' &&
        task.employee_id === loggedEmployee.id &&
        localStorage.getItem(packingTaskSeenKey(loggedEmployee.id, task.id)) !== '1'
      );
      setPackingTaskPopup(packing || null);
    };
    checkProductionTasks();
    const delayedCheck = window.setTimeout(checkProductionTasks, 1200);
    window.addEventListener('nxty_storage_change', checkProductionTasks);
    return () => {
      window.clearTimeout(delayedCheck);
      window.removeEventListener('nxty_storage_change', checkProductionTasks);
    };
  }, [loggedEmployee, currentRole]);

  // Ganti popup alert() browser dengan notifikasi halus di dalam aplikasi.
  // Berlaku untuk semua modul tanpa perlu mengubah satu per satu.
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg?: unknown) => setToast(String(msg ?? ''));
    return () => { window.alert = originalAlert; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Pantau status sinkronisasi Supabase
  useEffect(() => {
    const handler = (e: Event) => setCloudStatus((e as CustomEvent<CloudStatus>).detail);
    window.addEventListener('nxty_cloud_status', handler);
    return () => window.removeEventListener('nxty_cloud_status', handler);
  }, []);

  // Sub-tab sederhana per halaman
  const [salesSubTab, setSalesSubTab] = useState<'marketplace' | 'order'>('marketplace');
  const [karyawanSubTab, setKaryawanSubTab] = useState<'data' | 'absensi' | 'kasbon' | 'payroll'>('data');

  const permittedMenus = MENUS.filter(m => m.roles.includes(currentRole));
  const getMenuLabel = (menu: { id: string; label: string }) =>
    currentRole === 'karyawan' && menu.id === 'produksi' ? 'Daftar Kerjaan' : menu.label;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const dateStr = now.toLocaleDateString('id-ID', options);
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      setFormattedTime(`${dateStr} | ${timeStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Jika ganti role, arahkan ke menu pertama yang diizinkan
  useEffect(() => {
    if (!permittedMenus.some(m => m.id === activeTab)) {
      setActiveTab(permittedMenus[0]?.id || 'dashboard');
    }
  }, [currentRole, loggedEmployee]);

  // Navigasi dari dalam modul (event lama tetap didukung bila id-nya dikenal)
  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail && MENUS.some(m => m.id === detail)) setActiveTab(detail);
    };
    window.addEventListener('nxty_change_tab', handleTabChange);
    return () => window.removeEventListener('nxty_change_tab', handleTabChange);
  }, []);

  // Ekspor CSV (dipakai halaman Laporan)
  const handleExportCSV = (type: 'attendance' | 'invoices' | 'payroll' | 'expenses') => {
    let dataToExport: any[] = [];
    let filename = '';

    if (type === 'attendance') {
      dataToExport = dataStore.getAttendance();
      filename = 'Laporan_Kehadiran_ARI_SPORTINDO';
    } else if (type === 'invoices') {
      dataToExport = dataStore.getInvoices().map(inv => ({
        invoice_number: inv.invoice_number,
        customer: inv.customer_name,
        date: inv.date,
        due_date: inv.due_date,
        subtotal: inv.subtotal,
        dp: inv.dp,
        tax: inv.tax,
        total: inv.total,
        status: inv.payment_status
      }));
      filename = 'Laporan_Penjualan_ARI_SPORTINDO';
    } else if (type === 'payroll') {
      dataToExport = dataStore.getPayrollWeekly();
      filename = 'Laporan_Payroll_ARI_SPORTINDO';
    } else if (type === 'expenses') {
      dataToExport = dataStore.getDailyExpenses();
      filename = 'Laporan_Pengeluaran_ARI_SPORTINDO';
    }

    if (dataToExport.length === 0) {
      alert('Tidak ada data untuk diekspor!');
      return;
    }

    const headers = Object.keys(dataToExport[0]).join(',');
    const rows = dataToExport.map(row =>
      Object.values(row).map(val => {
        const text = String(val);
        return text.includes(',') ? `"${text.replace(/"/g, '""')}"` : text;
      }).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,﻿' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeMenu = MENUS.find(m => m.id === activeTab);

  // Notifikasi halus di atas layar (pengganti popup alert)
  const toastEl = toast && (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[calc(100%-2rem)] no-print">
      <div
        onClick={() => setToast(null)}
        className="bg-[#1F4B36] text-white text-sm rounded-xl shadow-xl px-4 py-3 whitespace-pre-line cursor-pointer border border-emerald-900/40 animate-fadeIn"
      >
        {toast}
      </div>
    </div>
  );

  // Belum login: tampilkan halaman login penuh
  if (!session) {
    return (
      <>
        {toastEl}
        <LoginPage onLogin={handleLogin} />
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-white font-sans text-gray-800 text-sm overflow-hidden">
      {toastEl}
      {handoffPopup && <div className="fixed inset-0 z-[90] bg-black/55 p-4 flex items-center justify-center no-print"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"><div><span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-1 rounded">Tugas Produksi Baru</span><h3 className="font-black text-gray-900 mt-3">{handoffPopup.product_name}</h3><p className="text-xs text-gray-500 mt-1">{handoffPopup.from_stage} → {handoffPopup.to_stage}</p></div><div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs"><p>Dari: <b>{handoffPopup.from_employee_name}</b></p><p>Jumlah diterima: <b>{handoffPopup.qty_sent} pcs</b></p>{handoffPopup.notes && <p className="mt-1 text-gray-500">{handoffPopup.notes}</p>}</div><p className="text-[11px] text-amber-700">Periksa barang fisik sebelum menekan Terima pada menu Produksi.</p><div className="grid grid-cols-2 gap-2"><button onClick={() => { localStorage.setItem(`nxty_handoff_seen_${handoffPopup.id}`, '1'); setHandoffPopup(null); }} className="py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold cursor-pointer">Nanti</button><button onClick={() => { localStorage.setItem(`nxty_handoff_seen_${handoffPopup.id}`, '1'); setHandoffPopup(null); setActiveTab('produksi'); }} className="py-2.5 rounded-xl bg-[#1F4B36] text-white text-xs font-bold cursor-pointer">Lihat & Konfirmasi</button></div></div></div>}
      {productionTaskPopup && <div className="fixed inset-0 z-[91] bg-black/55 p-4 flex items-center justify-center no-print"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"><div><span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Ada Kerjaan Baru</span><h3 className="font-black text-gray-900 mt-3">{productionTaskPopup.product_name}</h3><p className="text-xs text-gray-500 mt-1">{productionTaskPopup.order_number || productionTaskPopup.id} · tahap {productionTaskPopup.current_stage}</p></div><div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs"><p>Target: <b>{productionTaskPopup.qty} pcs</b></p>{productionTaskPopup.notes && <p className="mt-1 text-gray-500">{productionTaskPopup.notes}</p>}</div><p className="text-[11px] text-emerald-700">Buka Daftar Kerjaan untuk input hasil kerja atau reject jika ada.</p><div className="grid grid-cols-2 gap-2"><button onClick={() => { if (loggedEmployee) localStorage.setItem(productionTaskSeenKey(loggedEmployee.id, productionTaskPopup.id), '1'); setProductionTaskPopup(null); }} className="py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold cursor-pointer">Nanti</button><button onClick={() => { if (loggedEmployee) localStorage.setItem(productionTaskSeenKey(loggedEmployee.id, productionTaskPopup.id), '1'); setProductionTaskPopup(null); setActiveTab('produksi'); }} className="py-2.5 rounded-xl bg-[#1F4B36] text-white text-xs font-bold cursor-pointer">Lihat Kerjaan</button></div></div></div>}
      {packingTaskPopup && !productionTaskPopup && <div className="fixed inset-0 z-[91] bg-black/55 p-4 flex items-center justify-center no-print"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"><div><span className="text-[10px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-1 rounded">Ada Kerjaan Packing</span><h3 className="font-black text-gray-900 mt-3">{packingTaskPopup.order_number}</h3><p className="text-xs text-gray-500 mt-1">{packingTaskPopup.customer_name}</p></div><div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs"><p>Total barang: <b>{packingTaskPopup.items.reduce((sum, item) => sum + item.qty, 0)} pcs</b></p><p className="mt-1 text-gray-500">{packingTaskPopup.items.map(item => `${item.qty}x ${item.product_name}`).join(', ')}</p></div><p className="text-[11px] text-sky-700">Buka Daftar Kerjaan untuk menyelesaikan packing.</p><div className="grid grid-cols-2 gap-2"><button onClick={() => { if (loggedEmployee) localStorage.setItem(packingTaskSeenKey(loggedEmployee.id, packingTaskPopup.id), '1'); setPackingTaskPopup(null); }} className="py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold cursor-pointer">Nanti</button><button onClick={() => { if (loggedEmployee) localStorage.setItem(packingTaskSeenKey(loggedEmployee.id, packingTaskPopup.id), '1'); setPackingTaskPopup(null); setActiveTab('produksi'); }} className="py-2.5 rounded-xl bg-[#1F4B36] text-white text-xs font-bold cursor-pointer">Lihat Kerjaan</button></div></div></div>}

      {/* SIDEBAR DESKTOP — datar, tanpa grup */}
      <aside className="no-print hidden md:flex w-60 bg-[#1F4B36] flex-col shrink-0 border-r border-[#163826] text-white">
        <div className="h-16 border-b border-[#163826] shrink-0 flex items-center px-5">
          <div>
            <h1 className="text-white font-bold text-base tracking-tight">ARI SPORTINDO</h1>
            <span className="text-emerald-200/70 text-[11px] block">Sistem Produksi</span>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-1">
          {permittedMenus.map((menu) => {
            const Icon = menu.icon;
            const isSelected = activeTab === menu.id;
            return (
              <button
                key={menu.id}
                id={`nav-tab-${menu.id}`}
                onClick={() => setActiveTab(menu.id)}
                className={`w-full py-2.5 px-3 flex items-center gap-3 rounded-lg cursor-pointer transition-colors text-left ${
                  isSelected
                    ? 'bg-[#163826] text-white font-semibold border-l-4 border-amber-400'
                    : 'text-emerald-50/85 hover:bg-[#163826]/60'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-400' : 'opacity-70'}`} />
                <span className="truncate">{getMenuLabel(menu)}</span>
              </button>
            );
          })}
        </nav>

        {/* Info akun & logout */}
        <div className="p-4 border-t border-[#163826] space-y-3">
          {/* Status sinkronisasi data */}
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              cloudStatus === 'online' ? 'bg-emerald-400'
              : cloudStatus === 'connecting' ? 'bg-amber-400'
              : cloudStatus === 'error' ? 'bg-rose-500'
              : 'bg-gray-400'
            }`} />
            <span className="text-emerald-100/80">
              {cloudStatus === 'online' ? 'Tersinkron ke Cloud'
              : cloudStatus === 'connecting' ? 'Menghubungkan…'
              : cloudStatus === 'error' ? 'Cloud error — data lokal'
              : isCloudEnabled ? 'Offline' : 'Data lokal (offline)'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-800 shrink-0 overflow-hidden">
              {loggedEmployee?.photo_url ? (
                <img src={loggedEmployee.photo_url} alt={session.name} className="w-full h-full object-cover" />
              ) : (
                session.name[0]
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{session.name}</p>
              <p className="text-[11px] text-emerald-200/70 truncate">
                {ACTIVE_ROLES.find(r => r.id === session.role)?.label || 'Karyawan'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-[#163826] hover:bg-rose-700 border border-[#2a5941] hover:border-rose-700 text-white font-semibold text-xs py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col bg-gray-50 h-screen overflow-hidden">

        {/* HEADER */}
        <header className="no-print h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden bg-[#1F4B36] px-2 py-1 rounded text-white font-bold text-xs shrink-0">ARI</div>
            <h2 className="text-base font-semibold text-gray-800 truncate">{activeMenu?.label || 'Dashboard'}</h2>
          </div>
          <p className="hidden md:block text-xs text-gray-500 shrink-0">{formattedTime}</p>
          {/* Logout mobile */}
          <button
            onClick={handleLogout}
            className="md:hidden flex items-center gap-1 bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-rose-600"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </header>

        {/* MENU MOBILE — satu baris scroll */}
        <div className="no-print md:hidden flex overflow-x-auto bg-white border-b border-gray-200 px-3 py-2 gap-2 shrink-0">
          {permittedMenus.map((menu) => {
            const Icon = menu.icon;
            const isSelected = activeTab === menu.id;
            return (
              <button
                key={menu.id}
                onClick={() => setActiveTab(menu.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-[#1F4B36] text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{getMenuLabel(menu)}</span>
              </button>
            );
          })}
        </div>

        {/* KONTEN */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* DASHBOARD — angka nyata dihitung dari data tersimpan */}
            {activeTab === 'dashboard' && (
              <>
                {currentRole !== 'karyawan' && (
                  <MainDashboard role={currentRole} userName={session.name} />
                )}

                {currentRole === 'karyawan' && (
                  loggedEmployee ? (
                    <EmployeeDashboard
                      loggedEmployee={loggedEmployee}
                      onOpenAttendance={() => {
                        setOpenLocationScannerSignal(value => value + 1);
                        setActiveTab('absensi');
                      }}
                    />
                  ) : (
                    <KaryawanLoginCard onLogin={(emp) => handleLogin(sessionForEmployee(emp), emp)} />
                  )
                )}
              </>
            )}

            {/* PENJUALAN */}
            {activeTab === 'penjualan' && (
              <div className="space-y-4">
                <div className="bg-white p-1 rounded-xl border border-gray-200 inline-flex gap-1 no-print">
                  <button
                    onClick={() => setSalesSubTab('marketplace')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${
                      salesSubTab === 'marketplace' ? 'bg-[#1F4B36] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Penjualan Marketplace
                  </button>
                  <button
                    onClick={() => setSalesSubTab('order')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${
                      salesSubTab === 'order' ? 'bg-[#1F4B36] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Order Non-Marketplace
                  </button>
                </div>
                {salesSubTab === 'marketplace' ? <MarketplaceSalesModule /> : <OrderModule />}
              </div>
            )}

            {/* PEMBELIAN & PENGELUARAN (format approved, modul apa adanya) */}
            {activeTab === 'pembelian' && <PurchasesExpensesModule />}

            {/* GUDANG */}
            {activeTab === 'gudang' && <WarehouseInventoryModule userRole={currentRole} />}

            {/* PRODUKSI */}
            {activeTab === 'produksi' && <ProductionInventoryModule userRole={currentRole} currentEmployee={loggedEmployee} />}

            {/* KARYAWAN (owner): data + absensi + payroll */}
            {activeTab === 'karyawan' && (
              <div className="space-y-4">
                <div className="bg-white p-1 rounded-xl border border-gray-200 inline-flex gap-1 no-print">
                  <button
                    onClick={() => setKaryawanSubTab('data')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${
                      karyawanSubTab === 'data' ? 'bg-[#1F4B36] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Data Karyawan
                  </button>
                  <button
                    onClick={() => setKaryawanSubTab('absensi')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${
                      karyawanSubTab === 'absensi' ? 'bg-[#1F4B36] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Absensi
                  </button>
                  <button
                    onClick={() => setKaryawanSubTab('payroll')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${
                      karyawanSubTab === 'payroll' ? 'bg-[#1F4B36] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Payroll & Slip Gaji
                  </button>
                  <button
                    onClick={() => setKaryawanSubTab('kasbon')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${
                      karyawanSubTab === 'kasbon' ? 'bg-[#1F4B36] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Kasbon
                  </button>
                </div>

                {karyawanSubTab === 'data' && (
                  <EmployeeModule
                    currentLoggedEmployee={loggedEmployee}
                    onLoginEmployee={(emp) => {
                      if (emp) {
                        // Owner "login sebagai karyawan": ganti sesi ke portal karyawan
                        handleLogin(sessionForEmployee(emp), emp);
                      } else {
                        setLoggedEmployee(null);
                      }
                    }}
                    allTabs={MENUS.map(m => ({ id: m.id, label: m.label, icon: m.icon, roles: m.roles as string[] }))}
                  />
                )}
                {karyawanSubTab === 'absensi' && <AttendanceModule isAdmin={true} assistingAdmin={loggedEmployee} />}
                {karyawanSubTab === 'kasbon' && <CashAdvanceModule actor={loggedEmployee} />}
                {karyawanSubTab === 'payroll' && <PayrollModule isAdmin={true} loggedEmployee={null} />}
              </div>
            )}

            {/* PORTAL KARYAWAN: absensi & slip gaji pribadi (wajib login PIN) */}
            {activeTab === 'absensi' && (
              loggedEmployee
                ? <AttendanceModule isAdmin={false} lockedEmployee={loggedEmployee} openLocationScannerSignal={openLocationScannerSignal} />
                : <KaryawanLoginCard onLogin={(emp) => handleLogin(sessionForEmployee(emp), emp)} />
            )}
            {activeTab === 'gaji' && (
              loggedEmployee
                ? <PayrollModule isAdmin={false} loggedEmployee={loggedEmployee} />
                : <KaryawanLoginCard onLogin={(emp) => handleLogin(sessionForEmployee(emp), emp)} />
            )}

            {/* PROFIL SAYA: foto, nomor HP, ganti PIN */}
            {activeTab === 'profil' && (
              loggedEmployee
                ? <ProfileModule employee={loggedEmployee} onUpdated={setLoggedEmployee} />
                : <KaryawanLoginCard onLogin={(emp) => handleLogin(sessionForEmployee(emp), emp)} />
            )}

            {activeTab === 'audit' && <AuditRecycleModule />}

            {/* LAPORAN (owner): ekspor CSV */}
            {activeTab === 'laporan' && (
              <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-5">
                <div className="border-b border-gray-100 pb-4">
                  <h2 className="text-base font-bold text-[#1F4B36]">Pusat Laporan</h2>
                  <p className="text-sm text-gray-500">Unduh data ARI SPORTINDO dalam format CSV (Excel).</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {([
                    { type: 'invoices', title: 'Penjualan & Faktur', desc: 'Data pembeli, nominal, dan status bayar.' },
                    { type: 'expenses', title: 'Pengeluaran Harian', desc: 'Biaya operasional dan belanja harian.' },
                    { type: 'payroll', title: 'Payroll Mingguan', desc: 'Gaji, lembur, dan potongan per karyawan.' },
                    { type: 'attendance', title: 'Absensi Karyawan', desc: 'Riwayat scan masuk/pulang dan keterlambatan.' },
                  ] as const).map((r) => (
                    <div key={r.type} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                      <p className="text-sm font-bold text-gray-700">{r.title}</p>
                      <p className="text-xs text-gray-500">{r.desc}</p>
                      <button
                        onClick={() => handleExportCSV(r.type)}
                        className="bg-[#1F4B36] hover:bg-[#163826] text-white font-semibold text-sm px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4" /> Unduh CSV
                      </button>
                    </div>
                  ))}
                </div>

                {/* Zona persiapan pemakaian nyata */}
                <div className="border-t border-gray-100 pt-5">
                  <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-bold text-rose-800">Mulai Data Bersih</p>
                    <p className="text-xs text-rose-700 leading-relaxed">
                      Hapus semua data contoh/transaksi (pesanan, produksi, penjualan, pembelian, absensi, gaji) untuk
                      memulai pemakaian nyata. Data karyawan, produk, dan bahan baku tetap dipertahankan. Tidak bisa dibatalkan.
                    </p>
                    <button
                      onClick={() => {
                        if (!window.confirm('Yakin hapus SEMUA data transaksi?\n\nPesanan, produksi, penjualan, pembelian, absensi, dan gaji akan dikosongkan. Karyawan, produk, dan bahan baku tetap ada.\n\nTindakan ini tidak bisa dibatalkan.')) return;
                        if (!window.confirm('Konfirmasi sekali lagi: data transaksi akan dihapus permanen (termasuk di cloud). Lanjutkan?')) return;
                        dataStore.clearAllTransactions();
                        alert('Semua data transaksi telah dikosongkan. Sistem siap dipakai dengan data nyata.');
                      }}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm px-4 py-2 rounded-lg cursor-pointer"
                    >
                      Hapus Semua Data Contoh
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* FOOTER */}
        <footer className="no-print py-2.5 text-center border-t border-gray-200 bg-white text-xs text-gray-400 shrink-0">
          &copy; {new Date().getFullYear()} ARI SPORTINDO Production System
        </footer>
      </main>
    </div>
  );
}
