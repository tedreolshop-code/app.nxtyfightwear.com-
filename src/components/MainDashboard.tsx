import React, { useEffect, useState } from 'react';
import { UserRole } from '../types';
import { dataStore, wibTodayStr } from '../dataStore';
import {
  ShoppingBag, Hammer, Archive, AlertTriangle, Wallet,
  Users, TrendingUp, Clock, ChevronRight, BarChart3, ShoppingCart,
} from 'lucide-react';

interface MainDashboardProps {
  role: UserRole;
  userName: string;
}

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const formatIDRShort = (val: number) => {
  if (val >= 1_000_000) return `${(val / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (val >= 1_000) return `${Math.round(val / 1_000)} rb`;
  return `${val}`;
};

// Tanggal lokal (WIB), bukan UTC — toISOString() bisa mundur 1 hari sebelum jam 07:00.
const localDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const goTo = (tabId: string) =>
  window.dispatchEvent(new CustomEvent('nxty_change_tab', { detail: tabId }));
const goToEmployeeSubTab = (subTab: 'data' | 'absensi' | 'kasbon' | 'payroll') =>
  window.dispatchEvent(new CustomEvent('nxty_change_karyawan_subtab', { detail: subTab }));

// Channel penjualan dengan warna tetap (urutan tidak berubah walau nilainya 0).
// Palet sudah divalidasi aman untuk buta warna & kontras terhadap latar putih.
const CHANNELS = [
  { key: 'shopee', name: 'Shopee', color: '#E8590C' },
  { key: 'tokopedia', name: 'Tokopedia', color: '#15803D' },
  { key: 'tiktok', name: 'TikTok', color: '#DB2777' },
  { key: 'lainnya', name: 'Langsung / Lainnya', color: '#2563EB' },
] as const;
type ChannelKey = (typeof CHANNELS)[number]['key'];

const channelOf = (name?: string): ChannelKey => {
  const n = (name || '').toLowerCase();
  if (n.includes('shopee')) return 'shopee';
  if (n.includes('tokopedia') || n.includes('toped')) return 'tokopedia';
  if (n.includes('tiktok')) return 'tiktok';
  return 'lainnya';
};

type ChannelTotals = Record<ChannelKey, number>;
const emptyTotals = (): ChannelTotals => ({ shopee: 0, tokopedia: 0, tiktok: 0, lainnya: 0 });

// Dashboard dengan angka NYATA yang dihitung dari data tersimpan (bukan contoh statis).
export const MainDashboard: React.FC<MainDashboardProps> = ({ role, userName }) => {
  const [, setTick] = useState(0);
  const [hoverBar, setHoverBar] = useState<number | null>(null);

  useEffect(() => {
    const refresh = () => setTick(t => t + 1);
    window.addEventListener('nxty_storage_change', refresh);
    return () => window.removeEventListener('nxty_storage_change', refresh);
  }, []);

  const today = localDateStr(new Date());

  // === Hitung dari data nyata ===
  const orders = dataStore.getOrders();
  const orderAktif = orders.filter(o => o.status === 'pending' || o.status === 'production');
  const orderBaru = orders.filter(o => o.status === 'pending');

  // Penjualan per channel = detail item marketplace + rekap harian per channel + pesanan langsung
  const itemSales = dataStore.getMarketplaceItemSales();
  const dailyRekap = dataStore.getMarketplaceSales();
  const salesByChannelOnDate = (date: string): ChannelTotals => {
    const t = emptyTotals();
    itemSales.filter(s => s.date === date).forEach(s => { t[channelOf(s.marketplace_ref)] += s.total; });
    dailyRekap.filter(s => s.date === date).forEach(s => { t[channelOf(s.channel)] += s.revenue; });
    orders.filter(o => o.date === date && o.status !== 'cancelled')
      .forEach(o => { t[channelOf(o.source === 'online' ? o.marketplace_name : undefined)] += o.total; });
    return t;
  };
  const sumChannels = (t: ChannelTotals) => CHANNELS.reduce((sum, c) => sum + t[c.key], 0);

  const channelHariIni = salesByChannelOnDate(today);
  const penjualanHariIni = sumChannels(channelHariIni);

  // Pengeluaran = pengeluaran harian + purchase order (belanja bahan) yang tidak dibatalkan
  const expenses = dataStore.getDailyExpenses();
  const purchases = dataStore.getPurchases();
  const expensesOnDate = (date: string) =>
    expenses.filter(e => e.date === date).reduce((sum, e) => sum + e.amount, 0);
  const purchasesOnDate = (date: string) =>
    purchases.filter(p => p.date === date && p.status !== 'cancelled');

  const poHariIni = purchasesOnDate(today);
  const poHariIniTotal = poHariIni.reduce((sum, p) => sum + p.total_price, 0);
  const pengeluaranHarianHariIni = expensesOnDate(today);
  const pengeluaranHariIni = pengeluaranHarianHariIni + poHariIniTotal;

  // Tren penjualan 7 hari terakhir (termasuk hari ini), per channel
  const tren7Hari = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = localDateStr(d);
    const byChannel = salesByChannelOnDate(dateStr);
    return {
      date: dateStr,
      label: d.toLocaleDateString('id-ID', { weekday: 'short' }),
      fullLabel: d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }),
      byChannel,
      total: sumChannels(byChannel),
    };
  });
  const maxTren = Math.max(...tren7Hari.map(t => t.total), 1);
  const total7Hari = tren7Hari.reduce((sum, t) => sum + t.total, 0);
  const channel7Hari = tren7Hari.reduce((acc, t) => {
    CHANNELS.forEach(c => { acc[c.key] += t.byChannel[c.key]; });
    return acc;
  }, emptyTotals());
  const pengeluaran7Hari = tren7Hari.reduce(
    (sum, t) => sum + expensesOnDate(t.date) + purchasesOnDate(t.date).reduce((s, p) => s + p.total_price, 0), 0
  );

  // Laba kasar & pembanding vs kemarin
  const labaHariIni = penjualanHariIni - pengeluaranHariIni;
  const laba7Hari = total7Hari - pengeluaran7Hari;
  const kemarin = localDateStr(new Date(Date.now() - 86400000));
  const penjualanKemarin = sumChannels(salesByChannelOnDate(kemarin));
  const deltaVsKemarin = penjualanKemarin > 0
    ? ((penjualanHariIni - penjualanKemarin) / penjualanKemarin) * 100
    : null;

  // Produk terlaris & potongan admin marketplace, 7 hari terakhir
  const tanggal7Hari = new Set(tren7Hari.map(t => t.date));
  const itemSales7Hari = itemSales.filter(s => tanggal7Hari.has(s.date));
  const adminFee7Hari = itemSales7Hari.reduce((sum, s) => sum + s.admin_fee, 0);
  const produkTerlaris = Object.values(
    itemSales7Hari.reduce<Record<string, { name: string; qty: number; omset: number }>>((acc, s) => {
      const key = s.product_id || s.description.trim().toLowerCase();
      if (!acc[key]) acc[key] = { name: s.description, qty: 0, omset: 0 };
      acc[key].qty += s.qty;
      acc[key].omset += s.total;
      return acc;
    }, {})
  ).sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Nilai rupiah pesanan yang masih mengantre (pending + produksi)
  const nilaiOrderAktif = orderAktif.reduce((sum, o) => sum + o.total, 0);

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
  const todayWIB = wibTodayStr();
  const employees = dataStore.getEmployees().filter(e => e.status_aktif);
  const hadirHariIni = new Set(
    attendance.filter(a => a.timestamp.split('T')[0] === todayWIB && a.type_scan === 'masuk').map(a => a.employee_id)
  ).size;
  const pulangHariIni = new Set(
    attendance.filter(a => a.timestamp.split('T')[0] === todayWIB && a.type_scan === 'pulang').map(a => a.employee_id)
  ).size;
  const terlambatHariIni = attendance.filter(a => a.timestamp.split('T')[0] === todayWIB && (a.late_minutes || 0) > 0).length;
  const dibantuAdminHariIni = attendance.filter(a => a.timestamp.split('T')[0] === todayWIB && (a.verification_method || 'gps_self') === 'admin_qr').length;
  const karyawanAktif = employees.length;
  const belumMasukHariIni = Math.max(0, karyawanAktif - hadirHariIni);
  const belumPulangHariIni = Math.max(0, hadirHariIni - pulangHariIni);
  const pendingAttendanceSync = (() => {
    try {
      return JSON.parse(localStorage.getItem('nxty_attendance_pending') || '[]').length as number;
    } catch {
      return 0;
    }
  })();

  const currentWeekRange = (() => {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day - 1));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    return { start: localDateStr(monday), end: localDateStr(saturday) };
  })();
  const payrolls = dataStore.getPayrollWeekly();
  const payrollMingguIni = payrolls.filter(pay => pay.period_start >= currentWeekRange.start && pay.period_end <= currentWeekRange.end);
  const totalPayrollMingguIni = payrollMingguIni.reduce((sum, pay) => sum + pay.total_pay, 0);
  const karyawanBelumPayroll = Math.max(0, karyawanAktif - new Set(payrollMingguIni.map(pay => pay.employee_id)).size);
  const cashAdvances = dataStore.getCashAdvances();
  const totalKasbonAktif = cashAdvances.reduce((sum, advance) => sum + advance.remaining_balance, 0);
  const karyawanKasbonAktif = new Set(cashAdvances.filter(advance => advance.remaining_balance > 0).map(advance => advance.employee_id)).size;
  const cashAdvanceTransactions = dataStore.getCashAdvanceTransactions();
  const kasbonBaruMingguIni = cashAdvanceTransactions
    .filter(transaction => (transaction.type === 'create' || transaction.type === 'topup') && transaction.date >= currentWeekRange.start && transaction.date <= currentWeekRange.end)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const potonganKasbonMingguIni = cashAdvanceTransactions
    .filter(transaction => transaction.type === 'deduction' && transaction.date >= currentWeekRange.start && transaction.date <= currentWeekRange.end)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const absensiPerluCek = belumMasukHariIni + belumPulangHariIni + terlambatHariIni + dibantuAdminHariIni + pendingAttendanceSync;

  // === Kartu ringkasan per peran ===
  interface StatCard {
    label: string;
    value: string;
    sub?: string;
    warn?: boolean;
    icon: React.ComponentType<{ className?: string }>;
    tab: string;
    accent: { chip: string; icon: string; bar: string };
  }

  const accents = {
    emerald: { chip: 'bg-emerald-100', icon: 'text-emerald-700', bar: 'bg-emerald-500' },
    blue: { chip: 'bg-blue-100', icon: 'text-blue-700', bar: 'bg-blue-500' },
    rose: { chip: 'bg-rose-100', icon: 'text-rose-700', bar: 'bg-rose-500' },
    violet: { chip: 'bg-violet-100', icon: 'text-violet-700', bar: 'bg-violet-500' },
    amber: { chip: 'bg-amber-100', icon: 'text-amber-700', bar: 'bg-amber-500' },
    teal: { chip: 'bg-teal-100', icon: 'text-teal-700', bar: 'bg-teal-500' },
    sky: { chip: 'bg-sky-100', icon: 'text-sky-700', bar: 'bg-sky-500' },
  };

  const kartuPenjualan: StatCard[] = [
    { label: 'Penjualan Hari Ini', value: formatIDR(penjualanHariIni), sub: 'Detail item + rekap channel + pesanan', icon: TrendingUp, tab: 'penjualan', accent: accents.emerald },
    { label: 'Pesanan Aktif', value: formatIDR(nilaiOrderAktif), sub: `${orderAktif.length} pesanan · ${orderBaru.length} menunggu diproses`, warn: orderBaru.length > 0, icon: ShoppingBag, tab: 'penjualan', accent: accents.blue },
    { label: 'Pengeluaran Hari Ini', value: formatIDR(pengeluaranHariIni), sub: 'Pengeluaran harian + PO bahan baku', icon: Wallet, tab: 'pengeluaran', accent: accents.rose },
  ];

  const kartuProduksi: StatCard[] = [
    { label: 'Produksi Berjalan', value: `${jobAktif.length}`, sub: jobTerlambat.length > 0 ? `${jobTerlambat.length} lewat tenggat!` : 'Semua sesuai jadwal', warn: jobTerlambat.length > 0, icon: Hammer, tab: 'produksi', accent: accents.violet },
    { label: 'Bahan Baku Kritis', value: `${bahanKritis.length}`, sub: bahanKritis.length > 0 ? bahanKritis.map(m => m.name).slice(0, 2).join(', ') : 'Stok bahan aman', warn: bahanKritis.length > 0, icon: AlertTriangle, tab: 'gudang', accent: accents.amber },
    { label: 'Stok Produk Jadi', value: `${totalStokProduk} pcs`, sub: `${products.length} jenis produk`, icon: Archive, tab: 'gudang', accent: accents.teal },
  ];

  const kartuSDM: StatCard[] = [
    { label: 'Hadir Hari Ini', value: `${hadirHariIni} / ${karyawanAktif}`, sub: 'Karyawan sudah absen masuk', icon: Users, tab: 'karyawan', accent: accents.sky },
  ];

  let cards: StatCard[] = [];
  if (role === 'owner') cards = [...kartuPenjualan.slice(1), ...kartuProduksi, ...kartuSDM];
  else if (role === 'admin_penjualan') cards = kartuPenjualan;
  else if (role === 'admin_gudang') cards = kartuProduksi;

  // Daftar "perlu perhatian" untuk owner
  const perluPerhatian: Array<{ text: string; tab: string; serius: boolean }> = [];
  if (orderBaru.length > 0) perluPerhatian.push({ text: `${orderBaru.length} pesanan menunggu dikirim ke produksi`, tab: 'penjualan', serius: false });
  if (jobTerlambat.length > 0) perluPerhatian.push({ text: `${jobTerlambat.length} pekerjaan produksi lewat tenggat 7 hari`, tab: 'produksi', serius: true });
  bahanKritis.slice(0, 3).forEach(m => perluPerhatian.push({ text: `Stok ${m.name} tinggal ${m.current_stock} ${m.unit} (minimum ${m.stock_minimum})`, tab: 'gudang', serius: true }));
  if (karyawanBelumPayroll > 0) perluPerhatian.push({ text: `${karyawanBelumPayroll} karyawan belum punya slip gaji minggu ini`, tab: 'karyawan:payroll', serius: false });
  if (absensiPerluCek > 0) perluPerhatian.push({ text: `${absensiPerluCek} catatan absensi perlu dicek hari ini`, tab: 'karyawan:absensi', serius: false });
  if (totalKasbonAktif >= 1_000_000 || kasbonBaruMingguIni > 0) perluPerhatian.push({ text: `Kasbon aktif ${formatIDR(totalKasbonAktif)} dari ${karyawanKasbonAktif} karyawan`, tab: 'karyawan:kasbon', serius: totalKasbonAktif >= 1_000_000 });

  const goToAttentionTarget = (target: string) => {
    if (target === 'karyawan:payroll') return goToEmployeeSubTab('payroll');
    if (target === 'karyawan:absensi') return goToEmployeeSubTab('absensi');
    if (target === 'karyawan:kasbon') return goToEmployeeSubTab('kasbon');
    goTo(target);
  };

  return (
    <div className="space-y-5">
      {/* Hero header — sapaan + penjualan hari ini (owner) */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1F4B36] via-[#256446] to-[#2E7D54] p-5 sm:p-6 text-white shadow-lg shadow-emerald-900/10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">Halo, {userName.split(' ')[0]} 👋</h1>
            <p className="text-sm text-emerald-100/80">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {role === 'owner' && (
              <div className="mt-4">
                <span className="text-xs uppercase tracking-wide text-emerald-200/90 font-semibold">Penjualan Hari Ini</span>
                <div className="flex items-baseline gap-2.5 flex-wrap mt-0.5">
                  <span className="text-3xl font-black">{formatIDR(penjualanHariIni)}</span>
                  {deltaVsKemarin !== null && (
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                      deltaVsKemarin >= 0 ? 'bg-emerald-300/25 text-emerald-100' : 'bg-rose-400/30 text-rose-100'
                    }`}>
                      {deltaVsKemarin >= 0 ? '▲' : '▼'} {Math.abs(deltaVsKemarin).toLocaleString('id-ID', { maximumFractionDigits: 0 })}% vs kemarin
                    </span>
                  )}
                </div>
                <div className="text-xs text-emerald-100/80 mt-1">
                  Pengeluaran hari ini {formatIDR(pengeluaranHariIni)} · Penjualan 7 hari {formatIDR(total7Hari)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    labaHariIni >= 0 ? 'bg-white/15' : 'bg-rose-500/30'
                  }`}>
                    Laba kasar hari ini:
                    <span className={`font-black ${labaHariIni >= 0 ? 'text-emerald-100' : 'text-rose-100'}`}>
                      {formatIDR(labaHariIni)}
                    </span>
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    laba7Hari >= 0 ? 'bg-white/15' : 'bg-rose-500/30'
                  }`}>
                    7 hari:
                    <span className={`font-black ${laba7Hari >= 0 ? 'text-emerald-100' : 'text-rose-100'}`}>
                      {formatIDR(laba7Hari)}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
          {role === 'owner' && (
            <button
              onClick={() => goTo('penjualan')}
              className="self-start sm:self-end shrink-0 inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
            >
              Lihat Penjualan <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {role === 'owner' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button onClick={() => goToEmployeeSubTab('payroll')} className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">Payroll Minggu Ini</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
            <p className="mt-1 text-lg font-black text-gray-900">{formatIDR(totalPayrollMingguIni)}</p>
            <p className={`text-xs ${karyawanBelumPayroll > 0 ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>{payrollMingguIni.length} slip dibuat · {karyawanBelumPayroll} belum dibuat</p>
          </button>
          <button onClick={() => goToEmployeeSubTab('kasbon')} className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">Kasbon Aktif</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
            <p className="mt-1 text-lg font-black text-rose-700">{formatIDR(totalKasbonAktif)}</p>
            <p className="text-xs text-gray-400">{karyawanKasbonAktif} karyawan · baru {formatIDR(kasbonBaruMingguIni)} · potong {formatIDR(potonganKasbonMingguIni)}</p>
          </button>
          <button onClick={() => goToEmployeeSubTab('absensi')} className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">Absensi Perlu Cek</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
            <p className={`mt-1 text-lg font-black ${absensiPerluCek > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{absensiPerluCek}</p>
            <p className="text-xs text-gray-400">Belum masuk {belumMasukHariIni} · belum pulang {belumPulangHariIni} · telat {terlambatHariIni} · sync {pendingAttendanceSync}</p>
          </button>
        </div>
      )}

      {role === 'owner' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Rincian penjualan per channel */}
          <button
            onClick={() => goTo('penjualan')}
            className="bg-white rounded-2xl border border-gray-200 p-5 text-left hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[#1F4B36]" />
              <h3 className="text-sm font-bold text-gray-700">Penjualan per Channel</h3>
              <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-0 text-xs text-gray-400 font-semibold pb-2 border-b border-gray-100">
              <span>Channel</span>
              <span className="text-right">Hari Ini</span>
              <span className="text-right">7 Hari</span>
            </div>
            <div className="divide-y divide-gray-50">
              {CHANNELS.map(c => {
                const sharePct = penjualanHariIni > 0 ? (channelHariIni[c.key] / penjualanHariIni) * 100 : 0;
                return (
                  <div key={c.key} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-sm text-gray-700 truncate">{c.name}</span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${sharePct}%`, backgroundColor: c.color }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-800 text-right tabular-nums">{formatIDRShort(channelHariIni[c.key])}</span>
                    <span className="text-sm text-gray-500 text-right tabular-nums">{formatIDRShort(channel7Hari[c.key])}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 pt-2.5 border-t border-gray-200">
              <span className="text-sm font-bold text-gray-700">Total</span>
              <span className="text-sm font-black text-[#1F4B36] text-right tabular-nums">{formatIDRShort(penjualanHariIni)}</span>
              <span className="text-sm font-bold text-gray-600 text-right tabular-nums">{formatIDRShort(total7Hari)}</span>
            </div>
          </button>

          {/* Ringkasan pembelian & pengeluaran */}
          <button
            onClick={() => goTo('pembelian')}
            className="bg-white rounded-2xl border border-gray-200 p-5 text-left hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-gray-700">Pembelian & Pengeluaran</h3>
              <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
            </div>
            <div className="divide-y divide-gray-50">
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <span className="text-sm text-gray-700 block">PO Bahan Baku Hari Ini</span>
                  <span className="text-xs text-gray-400">{poHariIni.length} purchase order</span>
                </div>
                <span className="text-sm font-bold text-gray-800 tabular-nums">{formatIDR(poHariIniTotal)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <span className="text-sm text-gray-700 block">Pengeluaran Harian</span>
                  <span className="text-xs text-gray-400">Operasional & belanja lain</span>
                </div>
                <span className="text-sm font-bold text-gray-800 tabular-nums">{formatIDR(pengeluaranHarianHariIni)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2.5 border-t border-gray-200">
              <span className="text-sm font-bold text-gray-700">Total Hari Ini</span>
              <span className="text-sm font-black text-rose-600 tabular-nums">{formatIDR(pengeluaranHariIni)}</span>
            </div>
            <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">Total pengeluaran 7 hari terakhir</span>
              <span className="text-xs font-bold text-gray-700 tabular-nums">{formatIDR(pengeluaran7Hari)}</span>
            </div>
          </button>
        </div>
      )}

      {/* Grafik tren 7 hari + produk terlaris (owner) */}
      {role === 'owner' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#1F4B36]" />
              <h3 className="text-sm font-bold text-gray-700">Tren Penjualan 7 Hari</h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ml-auto">
              {CHANNELS.map(c => (
                <span key={c.key} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2 h-36" onMouseLeave={() => setHoverBar(null)}>
            {tren7Hari.map((t, i) => {
              const isToday = t.date === today;
              const isHover = hoverBar === i;
              return (
                <div
                  key={t.date}
                  className="relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer"
                  onMouseEnter={() => setHoverBar(i)}
                  onClick={() => goTo('penjualan')}
                >
                  {isHover && (
                    <div className="absolute -top-1 -translate-y-full z-10 bg-gray-800 text-white text-[11px] rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                      <div className="font-semibold mb-1">{t.fullLabel} · {formatIDR(t.total)}</div>
                      {CHANNELS.filter(c => t.byChannel[c.key] > 0).map(c => (
                        <div key={c.key} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name}: {formatIDRShort(t.byChannel[c.key])}
                        </div>
                      ))}
                      {t.total === 0 && <div className="text-gray-300">Tidak ada penjualan</div>}
                    </div>
                  )}
                  <span className={`text-[10px] mb-1 font-semibold tabular-nums ${t.total === maxTren && t.total > 0 ? 'text-gray-600' : 'text-transparent'}`}>
                    {formatIDRShort(t.total)}
                  </span>
                  <div
                    className={`w-full max-w-[36px] flex flex-col-reverse rounded-t overflow-hidden transition-opacity ${
                      hoverBar !== null && !isHover ? 'opacity-50' : ''
                    }`}
                    style={{ height: `${t.total > 0 ? Math.max((t.total / maxTren) * 100, 4) : 1.5}%` }}
                  >
                    {t.total === 0 && <div className="h-full bg-gray-200" />}
                    {CHANNELS.filter(c => t.byChannel[c.key] > 0).map((c, idx) => (
                      <div
                        key={c.key}
                        style={{
                          height: `${(t.byChannel[c.key] / t.total) * 100}%`,
                          backgroundColor: c.color,
                          marginTop: idx > 0 ? 2 : 0,
                        }}
                      />
                    ))}
                  </div>
                  <span className={`text-[11px] mt-1.5 ${isToday ? 'font-bold text-[#1F4B36]' : 'text-gray-400'}`}>
                    {t.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Produk terlaris 7 hari */}
        <button
          onClick={() => goTo('penjualan')}
          className="bg-white rounded-2xl border border-gray-200 p-5 text-left hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-4">
            <Archive className="w-4 h-4 text-[#1F4B36]" />
            <h3 className="text-sm font-bold text-gray-700">Produk Terlaris 7 Hari</h3>
            <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
          </div>
          {produkTerlaris.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada penjualan per item dalam 7 hari terakhir.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {produkTerlaris.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-3 py-2">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                    idx === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-gray-400 tabular-nums shrink-0">{p.qty} pcs</span>
                  <span className="text-sm font-bold text-gray-800 tabular-nums shrink-0 w-16 text-right">{formatIDRShort(p.omset)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-xs text-amber-800">Potongan admin marketplace 7 hari</span>
            <span className="text-xs font-bold text-amber-800 tabular-nums">{formatIDR(adminFee7Hari)}</span>
          </div>
        </button>
        </div>
      )}

      {/* Kartu angka */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => goTo(c.tab)}
              className={`relative overflow-hidden bg-white p-5 rounded-2xl border text-left transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${
                c.warn ? 'border-amber-300' : 'border-gray-200'
              }`}
            >
              <span className={`absolute left-0 top-0 bottom-0 w-1 ${c.warn ? 'bg-amber-400' : c.accent.bar}`} />
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-500">{c.label}</span>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.warn ? 'bg-amber-100' : c.accent.chip}`}>
                  <Icon className={`w-4 h-4 ${c.warn ? 'text-amber-700' : c.accent.icon}`} />
                </span>
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
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-gray-700">Perlu Perhatian</h3>
            <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
              {perluPerhatian.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {perluPerhatian.map((item, idx) => (
              <button
                key={idx}
                onClick={() => goToAttentionTarget(item.tab)}
                className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-gray-50 cursor-pointer"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${item.serius ? 'bg-rose-500' : 'bg-amber-400'}`} />
                <span className="text-sm text-gray-700 flex-1">{item.text}</span>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {role === 'owner' && perluPerhatian.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-800 font-medium">
          ✓ Tidak ada yang mendesak — pesanan, produksi, dan stok dalam kondisi aman.
        </div>
      )}
    </div>
  );
};
