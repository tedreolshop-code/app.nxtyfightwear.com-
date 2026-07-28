import React, { useMemo, useState } from 'react';
import { PaymentEntry, PaymentState, PAYMENT_STATE_LABEL, divisionLabel, paymentStateOf, remainingOf } from '../types';
import { DivisionFilter, matchesDivision } from './DivisionFilter';
import { Wallet, CalendarClock, Plus, X } from 'lucide-react';

/** Satu tagihan: bisa hutang ke supplier (dari PO) atau piutang pelanggan (dari order). */
export interface LedgerRow {
  id: string;
  ref: string;            // No PO / No Order
  party: string;          // Supplier / Pelanggan
  date: string;
  dueDate?: string;
  /** Divisi yang terkait. Order bisa berisi barang dua divisi, jadi berupa daftar. */
  departmentIds: string[];
  total: number;
  paid: number;
  payments: PaymentEntry[];
}

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const stateClass: Record<PaymentState, string> = {
  belum_bayar: 'bg-rose-100 text-rose-700 border-rose-200',
  sebagian: 'bg-amber-100 text-amber-800 border-amber-200',
  lunas: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const divisionBadgeClass = (departmentId?: string) =>
  departmentId === 'dept-eva-foam' ? 'bg-emerald-100 text-emerald-800'
    : departmentId === 'dept-konveksi' ? 'bg-sky-100 text-sky-800'
    : 'bg-gray-100 text-gray-600';

/**
 * Buku hutang/piutang. Barisnya TURUNAN dari PO dan order — tidak ada data yang
 * diinput sendiri di sini, supaya angkanya tidak pernah berbeda dari transaksi asalnya.
 */
export const PaymentLedger: React.FC<{
  title: string;
  subtitle: string;
  /** Sebutan pihak lawan: "Supplier" untuk hutang, "Pelanggan" untuk piutang. */
  partyLabel: string;
  rows: LedgerRow[];
  todayStr: string;
  onPay: (rowId: string, amount: number, date: string, note?: string) => void;
}> = ({ title, subtitle, partyLabel, rows, todayStr, onPay }) => {
  const [divFilter, setDivFilter] = useState('');
  const [showPaid, setShowPaid] = useState(false);
  const [payTarget, setPayTarget] = useState<LedgerRow | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(todayStr);
  const [payNote, setPayNote] = useState('');

  const visible = useMemo(() => rows
    .filter(row => {
      const state = paymentStateOf(row.total, row.paid);
      if (!showPaid && state === 'lunas') return false;
      if (!divFilter) return true;
      // Transaksi tanpa divisi hanya muncul di ember "Bersama"; satu order boleh
      // berisi dua divisi, cukup salah satunya cocok.
      if (row.departmentIds.length === 0) return divFilter === 'shared';
      return row.departmentIds.some(id => matchesDivision(id, divFilter));
    })
    // Jatuh tempo terdekat lebih dulu; yang tanpa jatuh tempo di belakang
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || b.date.localeCompare(a.date)),
    [rows, divFilter, showPaid]);

  const outstanding = visible.reduce((sum, row) => sum + remainingOf(row.total, row.paid), 0);
  const jatuhTempo = visible.filter(row => row.dueDate && row.dueDate < todayStr && remainingOf(row.total, row.paid) > 0);
  const jatuhTempoTotal = jatuhTempo.reduce((sum, row) => sum + remainingOf(row.total, row.paid), 0);

  const openPay = (row: LedgerRow) => {
    setPayTarget(row);
    setPayAmount(remainingOf(row.total, row.paid)); // bawaan: pelunasan penuh
    setPayDate(todayStr);
    setPayNote('');
  };

  const submitPay = () => {
    if (!payTarget) return;
    const sisa = remainingOf(payTarget.total, payTarget.paid);
    if (payAmount <= 0) return alert('Jumlah pembayaran harus lebih dari nol.');
    if (payAmount > sisa) return alert(`Jumlah melebihi sisa tagihan (${formatIDR(sisa)}).`);
    onPay(payTarget.id, payAmount, payDate, payNote.trim() || undefined);
    setPayTarget(null);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <div className="p-4 bg-gray-50/60 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-[var(--color-evergreen)]" /> {title}
          </h3>
          <p className="text-xs text-gray-800">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DivisionFilter value={divFilter} onChange={setDivFilter} sharedLabel="Bersama" />
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={showPaid} onChange={e => setShowPaid(e.target.checked)} className="accent-[var(--color-evergreen)]" />
            Tampilkan yang lunas
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border-b border-gray-100">
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Belum Lunas</p>
          <p className="font-mono font-black text-lg text-gray-800">{formatIDR(outstanding)}</p>
          <p className="text-[10px] text-gray-500">{visible.filter(r => remainingOf(r.total, r.paid) > 0).length} tagihan</p>
        </div>
        <div className={`rounded-lg p-3 border ${jatuhTempo.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-100'}`}>
          <p className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
            <CalendarClock className="w-3 h-3" /> Lewat Jatuh Tempo
          </p>
          <p className={`font-mono font-black text-lg ${jatuhTempo.length > 0 ? 'text-rose-700' : 'text-gray-400'}`}>
            {formatIDR(jatuhTempoTotal)}
          </p>
          <p className="text-[10px] text-gray-500">{jatuhTempo.length} tagihan</p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Sudah Dibayar</p>
          <p className="font-mono font-black text-lg text-emerald-700">
            {formatIDR(visible.reduce((sum, row) => sum + row.paid, 0))}
          </p>
          <p className="text-[10px] text-gray-500">dari {formatIDR(visible.reduce((sum, row) => sum + row.total, 0))}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-evergreen text-white font-bold uppercase tracking-wider text-[10px]">
              <th className="p-2 w-10 text-center">No</th>
              <th className="p-2">Referensi</th>
              <th className="p-2">{partyLabel}</th>
              <th className="p-2 w-28">Divisi</th>
              <th className="p-2 w-28">Jatuh Tempo</th>
              <th className="p-2 w-28 text-right">Tagihan</th>
              <th className="p-2 w-28 text-right">Dibayar</th>
              <th className="p-2 w-28 text-right">Sisa</th>
              <th className="p-2 w-24 text-center">Status</th>
              <th className="p-2 w-24 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-gray-400 italic">
                  {rows.length === 0 ? 'Belum ada tagihan tercatat.' : 'Tidak ada tagihan yang cocok dengan filter.'}
                </td>
              </tr>
            ) : visible.map((row, index) => {
              const sisa = remainingOf(row.total, row.paid);
              const state = paymentStateOf(row.total, row.paid);
              const lewatTempo = !!row.dueDate && row.dueDate < todayStr && sisa > 0;
              return (
                <tr key={row.id} className={`border-b border-emerald-200 hover:bg-emerald-50/20 ${lewatTempo ? 'bg-rose-50/50' : ''}`}>
                  <td className="p-2 text-center text-gray-400">{index + 1}</td>
                  <td className="p-2 font-mono font-bold text-gray-800">
                    {row.ref}
                    <span className="block text-[10px] font-sans font-normal text-gray-400">{row.date}</span>
                  </td>
                  <td className="p-2 font-semibold text-gray-700">{row.party}</td>
                  <td className="p-2">
                    {row.departmentIds.length === 0 ? (
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-100 text-gray-600">Bersama</span>
                    ) : row.departmentIds.map(id => (
                      <span key={id} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase mr-1 ${divisionBadgeClass(id)}`}>
                        {divisionLabel(id)}
                      </span>
                    ))}
                  </td>
                  <td className={`p-2 font-mono ${lewatTempo ? 'text-rose-700 font-bold' : 'text-gray-500'}`}>
                    {row.dueDate || '—'}
                    {lewatTempo && <span className="block text-[9px] font-sans">lewat tempo</span>}
                  </td>
                  <td className="p-2 text-right font-mono text-gray-700">{formatIDR(row.total)}</td>
                  <td className="p-2 text-right font-mono text-emerald-700">{formatIDR(row.paid)}</td>
                  <td className={`p-2 text-right font-mono font-black ${sisa > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                    {formatIDR(sisa)}
                  </td>
                  <td className="p-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${stateClass[state]}`}>
                      {PAYMENT_STATE_LABEL[state]}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    {sisa > 0 ? (
                      <button
                        onClick={() => openPay(row)}
                        className="bg-[var(--color-evergreen)] hover:bg-opacity-90 text-white text-[10px] font-bold px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Bayar
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400">selesai</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPayTarget(null)}>
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain p-5 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-2 border-b border-gray-100 pb-3">
              <div>
                <h4 className="font-bold text-sm text-gray-800">Catat Pembayaran</h4>
                <p className="text-xs text-gray-800">{payTarget.ref} · {payTarget.party}</p>
              </div>
              <button type="button" onClick={() => setPayTarget(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Tagihan</span><span className="font-mono font-bold">{formatIDR(payTarget.total)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Sudah dibayar</span><span className="font-mono text-emerald-700">{formatIDR(payTarget.paid)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1">
                <span className="font-bold text-gray-700">Sisa</span>
                <span className="font-mono font-black">{formatIDR(remainingOf(payTarget.total, payTarget.paid))}</span>
              </div>
            </div>

            {payTarget.payments.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase">Riwayat Pembayaran</p>
                {payTarget.payments.map(p => (
                  <div key={p.id} className="flex justify-between text-[11px] bg-white border border-gray-100 rounded px-2 py-1">
                    <span className="text-gray-500">{p.date}{p.note ? ` · ${p.note}` : ''}</span>
                    <span className="font-mono font-bold text-gray-700">{formatIDR(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Jumlah Bayar</label>
                <input
                  type="number"
                  min={0}
                  value={payAmount || ''}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tanggal Bayar</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Catatan (opsional)</label>
              <input
                type="text"
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
                placeholder="Transfer BCA, tunai, dsb."
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setPayTarget(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 cursor-pointer">
                Batal
              </button>
              <button type="button" onClick={submitPay} className="flex-[2] py-2.5 bg-[var(--color-evergreen)] text-white rounded-xl text-xs font-bold cursor-pointer">
                Simpan Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentLedger;
