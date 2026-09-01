import React from 'react';
import { AttendanceBonusPayout, terbilang } from './types';
import { dataStore } from './dataStore';
import { brandInitials } from './brand';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const monthLabel = (month: string) => {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
};
const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

/**
 * Dokumen slip bonus kehadiran A4 — sejajar dengan slip gaji mingguan.
 * Dipakai panel admin (Buku Slip Bonus) DAN riwayat bonus milik karyawan.
 * `deptLabel` sudah dalam bentuk siap tampil (mis. "EVA FOAM" / "Umum").
 */
export const renderBonusSlipLayout = (p: AttendanceBonusPayout, deptLabel: string) => {
  const brand = dataStore.getBrandSettings();
  const warna = brand.primary_color || '#1F4B36';
  const dept = deptLabel.toUpperCase();
  const dailyRate = p.working_days > 0 ? Math.round(p.amount / Math.max(1, p.present_days - p.half_days)) : 0;
  return (
    <div className="bg-white text-slate-800 text-[11px] leading-relaxed flex flex-col gap-4 select-text">
      <div className="flex items-start justify-between gap-4 pb-3 border-b-2" style={{ borderColor: warna }}>
        <div className="flex items-center gap-3 min-w-0">
          {brand.logo_data_url
            ? <img src={brand.logo_data_url} alt="" className="w-14 h-14 object-contain shrink-0" />
            : <div className="w-14 h-14 shrink-0 rounded flex items-center justify-center text-white font-black text-lg" style={{ backgroundColor: warna }}>{brandInitials(brand.company_name)}</div>}
          <div className="min-w-0">
            <p className="font-black text-base uppercase tracking-wide truncate" style={{ color: warna }}>{brand.company_name}</p>
            {brand.legal_name && brand.legal_name !== brand.company_name && <p className="text-[10px] text-slate-500 truncate">{brand.legal_name}</p>}
            {brand.tagline && <p className="text-[10px] text-slate-400 truncate">{brand.tagline}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-sm uppercase tracking-widest" style={{ color: warna }}>Slip Bonus</p>
          <p className="text-[10px] text-slate-500">Bonus Kehadiran Bulanan</p>
          <p className="text-[10px] text-slate-400 mt-1">No. {p.id.toUpperCase()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <div className="space-y-1">
          <div className="flex gap-2"><span className="w-20 shrink-0 text-slate-500">Nama</span><span className="font-bold uppercase">: {p.employee_name}</span></div>
          <div className="flex gap-2"><span className="w-20 shrink-0 text-slate-500">Divisi</span><span className="font-semibold">: {dept}</span></div>
        </div>
        <div className="space-y-1">
          <div className="flex gap-2"><span className="w-20 shrink-0 text-slate-500">Bulan</span><span className="font-semibold">: {monthLabel(p.month)}</span></div>
          <div className="flex gap-2"><span className="w-20 shrink-0 text-slate-500">Status</span><span className="font-semibold">: {p.status !== 'cair' ? 'Gugur' : p.payment_status === 'paid' ? 'Lunas' : 'Belum Dibayar'}</span></div>
        </div>
      </div>

      <div>
        <p className="font-bold text-[10px] uppercase tracking-wider text-slate-500 mb-1">Rekap Penilaian Kehadiran</p>
        <table className="w-full border-collapse">
          <tbody>
            <tr className="border-b border-slate-100"><td className="py-1.5 pr-2">Hari kerja bulan ini</td><td className="py-1.5 text-right font-semibold tabular-nums">{p.working_days} hari</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1.5 pr-2">Hari hadir</td><td className="py-1.5 text-right font-semibold tabular-nums">{p.present_days} hari</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1.5 pr-2">Total keterlambatan (bersih)</td><td className="py-1.5 text-right font-semibold tabular-nums">{p.late_minutes_net} menit</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1.5 pr-2">Setengah hari</td><td className="py-1.5 text-right font-semibold tabular-nums">{p.half_days}x</td></tr>
          </tbody>
        </table>
        {p.status !== 'cair' && p.reason && (
          <p className="text-[10px] text-rose-700 mt-1.5">Bonus gugur: {p.reason}</p>
        )}
      </div>

      <div className="rounded-lg px-4 py-3 text-white flex items-center justify-between gap-4" style={{ backgroundColor: p.status === 'cair' ? warna : '#9f1239' }}>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest opacity-80">{p.status === 'cair' ? 'Bonus Diterima' : 'Bonus Gugur'}</p>
          <p className="text-[9px] italic opacity-90 capitalize leading-tight break-words">{p.status === 'cair' ? terbilang(p.amount) : 'nol rupiah'}</p>
          {dailyRate > 0 && p.status === 'cair' && <p className="text-[9px] opacity-80">≈ {(p.present_days - p.half_days)} hari layak × {formatIDR(dailyRate)}</p>}
        </div>
        <p className="text-xl font-black tabular-nums whitespace-nowrap">{formatIDR(p.status === 'cair' ? p.amount : 0)}</p>
      </div>

      <div className="grid grid-cols-2 gap-6 pt-2 text-center text-[10px]">
        <div>
          <p className="text-slate-500">Diterima oleh,</p>
          <div className="h-14 border-b border-slate-300 mx-6" />
          <p className="mt-1 font-semibold uppercase">{p.employee_name}</p>
          <p className="text-slate-400">Karyawan</p>
        </div>
        <div>
          <p className="text-slate-500">Dibayarkan oleh,</p>
          <div className="h-14 border-b border-slate-300 mx-6" />
          <p className="mt-1 font-semibold uppercase">&nbsp;</p>
          <p className="text-slate-400">Bagian Keuangan</p>
        </div>
      </div>

      <p className="text-[9px] text-slate-400 text-center border-t border-slate-100 pt-2">
        Dinilai otomatis dari catatan absensi. Dibayarkan setiap tanggal 1. Dokumen diterbitkan oleh sistem {brand.company_name}.
      </p>
    </div>
  );
};
