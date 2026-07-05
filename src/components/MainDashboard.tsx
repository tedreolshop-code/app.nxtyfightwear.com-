import React, { useEffect, useState } from 'react';
import { UserRole } from '../types';
import { dataStore } from '../dataStore';
import {
  ShoppingBag, Hammer, Archive, AlertTriangle, Wallet,
  Users, TrendingUp, Clock, ChevronRight,
} from 'lucide-react';

interface MainDashboardProps {
  role: UserRole;
  userName: string;
}

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const goTo = (tabId: string) =>
  window.dispatchEvent(new CustomEvent('nxty_change_tab', { detail: tabId }));

// Dashboard dengan angka NYATA yang dihitung dari data tersimpan (bukan contoh statis).
export const MainDashboard: React.FC<MainDashboardProps> = ({ role, userName }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick(t => t + 1);
    window.addEventListener('nxty_storage_change', refresh);
    return () => window.removeEventListener('nxty_storage_change', refresh);
  }, []);

  const today = new Date().toISOString().split('T')[0];

  // === Hitung dari data nyata ===
  const orders = dataStore.getOrders();
  const orderAktif = orders.filter(o => o.status === 'pending' || o.status === 'production');
  const orderBaru = orders.filter(o => o.status === 'pending');

  const itemSales = dataStore.getMarketplaceItemSales();
  const penjualanHariIni = itemSales.filter(s => s.date === today).reduce((sum, s) => sum + s.total, 0)
    + orders.filter(o => o.date === today && o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0);

  const expenses = dataStore.getDailyExpenses();
  const pengeluaranHariIni = expenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);

  const jobs = dataStore.getProductionJobs();
  const jobAktif = jobs.filter(j => j.status !== 'completed');
  const jobTerlambat = jobAktif.filter(j => {
    const created = new Date(j.created_at || Date.now());
    return created.getTime() + 7 * 24 * 60 * 60 * 1000 < Date.now();
  });

  const materials = dataStore.getRawMaterials();
  const bahanKritis = materials.filter(m => m.current_stock <= m.stock_minimum);

  const products = dataStore.getProducts();
  const totalStokProduk = products.reduce((sum, p) => sum + p.stock, 0);

  const attendance = dataStore.getAttendance();
  const hadirHariIni = new Set(
    attendance.filter(a => a.timestamp.split('T')[0] === today && a.type_scan === 'masuk').map(a => a.employee_id)
  ).size;
  const karyawanAktif = dataStore.getEmployees().filter(e => e.status_aktif).length;

  // === Kartu ringkasan per peran ===
  interface StatCard {
    label: string;
    value: string;
    sub?: string;
    warn?: boolean;
    icon: React.ComponentType<{ className?: string }>;
    tab: string;
  }

  const kartuPenjualan: StatCard[] = [
    { label: 'Penjualan Hari Ini', value: formatIDR(penjualanHariIni), sub: 'Marketplace + pesanan langsung', icon: TrendingUp, tab: 'penjualan' },
    { label: 'Pesanan Aktif', value: `${orderAktif.length}`, sub: `${orderBaru.length} menunggu diproses`, warn: orderBaru.length > 0, icon: ShoppingBag, tab: 'penjualan' },
    { label: 'Pengeluaran Hari Ini', value: formatIDR(pengeluaranHariIni), sub: 'Belanja & operasional', icon: Wallet, tab: 'pembelian' },
  ];

  const kartuProduksi: StatCard[] = [
    { label: 'Produksi Berjalan', value: `${jobAktif.length}`, sub: jobTerlambat.length > 0 ? `${jobTerlambat.length} lewat tenggat!` : 'Semua sesuai jadwal', warn: jobTerlambat.length > 0, icon: Hammer, tab: 'produksi' },
    { label: 'Bahan Baku Kritis', value: `${bahanKritis.length}`, sub: bahanKritis.length > 0 ? bahanKritis.map(m => m.name).slice(0, 2).join(', ') : 'Stok bahan aman', warn: bahanKritis.length > 0, icon: AlertTriangle, tab: 'gudang' },
    { label: 'Stok Produk Jadi', value: `${totalStokProduk} pcs`, sub: `${products.length} jenis produk`, icon: Archive, tab: 'gudang' },
  ];

  const kartuSDM: StatCard[] = [
    { label: 'Hadir Hari Ini', value: `${hadirHariIni} / ${karyawanAktif}`, sub: 'Karyawan sudah absen masuk', icon: Users, tab: 'karyawan' },
  ];

  let cards: StatCard[] = [];
  if (role === 'owner') cards = [...kartuPenjualan, ...kartuProduksi, ...kartuSDM];
  else if (role === 'admin_penjualan') cards = kartuPenjualan;
  else if (role === 'admin_gudang') cards = kartuProduksi;

  // Daftar "perlu perhatian" untuk owner
  const perluPerhatian: Array<{ text: string; tab: string }> = [];
  if (orderBaru.length > 0) perluPerhatian.push({ text: `${orderBaru.length} pesanan menunggu dikirim ke produksi`, tab: 'penjualan' });
  if (jobTerlambat.length > 0) perluPerhatian.push({ text: `${jobTerlambat.length} pekerjaan produksi lewat tenggat 7 hari`, tab: 'produksi' });
  bahanKritis.slice(0, 3).forEach(m => perluPerhatian.push({ text: `Stok ${m.name} tinggal ${m.current_stock} ${m.unit} (minimum ${m.stock_minimum})`, tab: 'gudang' }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-[#1F4B36]">Halo, {userName.split(' ')[0]} 👋</h1>
        <p className="text-sm text-gray-500">
          Ringkasan {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Kartu angka */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => goTo(c.tab)}
              className={`bg-white p-5 rounded-xl border text-left transition-colors cursor-pointer hover:border-[#1F4B36] ${
                c.warn ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-500">{c.label}</span>
                <Icon className={`w-4 h-4 ${c.warn ? 'text-amber-600' : 'text-[#1F4B36]'}`} />
              </div>
              <span className="text-2xl font-black text-gray-800 block truncate">{c.value}</span>
              {c.sub && (
                <span className={`text-xs mt-1 block truncate ${c.warn ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>
                  {c.sub}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Perlu perhatian (owner) */}
      {role === 'owner' && perluPerhatian.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-gray-700">Perlu Perhatian</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {perluPerhatian.map((item, idx) => (
              <button
                key={idx}
                onClick={() => goTo(item.tab)}
                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 cursor-pointer"
              >
                <span className="text-sm text-gray-700">{item.text}</span>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {role === 'owner' && perluPerhatian.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-800 font-medium">
          ✓ Tidak ada yang mendesak — pesanan, produksi, dan stok dalam kondisi aman.
        </div>
      )}
    </div>
  );
};
