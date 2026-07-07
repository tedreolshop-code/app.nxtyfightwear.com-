import React, { useEffect, useMemo, useState } from 'react';
import { CashAdvance, CashAdvanceTransaction, Employee } from '../types';
import { dataStore, wibTodayStr } from '../dataStore';
import { CreditCard, Plus, RefreshCw, Search, WalletCards } from 'lucide-react';

interface CashAdvanceModuleProps {
  actor?: Employee | null;
}

const formatIDR = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;

export const CashAdvanceModule: React.FC<CashAdvanceModuleProps> = ({ actor }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<CashAdvance[]>([]);
  const [transactions, setTransactions] = useState<CashAdvanceTransaction[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedAdvanceId, setSelectedAdvanceId] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(wibTodayStr());
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'create' | 'topup' | 'payment'>('create');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const loadData = () => {
    setEmployees(dataStore.getEmployees().filter(employee => employee.status_aktif));
    setAdvances(dataStore.getCashAdvances());
    setTransactions(dataStore.getCashAdvanceTransactions());
  };

  useEffect(() => {
    loadData();
    const handleStorageChange = () => loadData();
    window.addEventListener('nxty_storage_change', handleStorageChange);
    return () => window.removeEventListener('nxty_storage_change', handleStorageChange);
  }, []);

  const selectedEmployee = employees.find(employee => employee.id === selectedEmployeeId);
  const activeAdvances = advances.filter(advance => advance.employee_id === selectedEmployeeId && advance.remaining_balance > 0);
  const totalOutstanding = advances.reduce((sum, advance) => sum + advance.remaining_balance, 0);
  const selectedOutstanding = activeAdvances.reduce((sum, advance) => sum + advance.remaining_balance, 0);
  const employeesWithBalance = useMemo(() => employees.map(employee => {
    const balance = advances.filter(advance => advance.employee_id === employee.id).reduce((sum, advance) => sum + advance.remaining_balance, 0);
    return { employee, balance };
  }).filter(item => !search.trim() || `${item.employee.name} ${item.employee.username}`.toLowerCase().includes(search.trim().toLowerCase())), [employees, advances, search]);

  const resetForm = () => {
    setAmount(0);
    setNote('');
    setSelectedAdvanceId('');
    setDate(wibTodayStr());
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      if (!selectedEmployeeId) throw new Error('Pilih karyawan terlebih dahulu.');
      if (mode === 'create') {
        dataStore.createCashAdvance({
          employee_id: selectedEmployeeId,
          amount,
          date,
          note: note.trim() || undefined,
          created_by_id: actor?.id,
          created_by_name: actor?.name
        });
        setMessage({ text: 'Kasbon baru berhasil dicatat.', error: false });
      } else if (mode === 'topup') {
        if (!selectedAdvanceId) throw new Error('Pilih kasbon aktif yang akan ditambah.');
        dataStore.topUpCashAdvance({
          cash_advance_id: selectedAdvanceId,
          amount,
          date,
          note: note.trim() || undefined,
          created_by_id: actor?.id,
          created_by_name: actor?.name
        });
        setMessage({ text: 'Saldo kasbon berhasil ditambahkan.', error: false });
      } else {
        dataStore.applyCashAdvancePayment({
          employee_id: selectedEmployeeId,
          amount,
          type: 'payment',
          date,
          note: note.trim() || 'Pembayaran kasbon manual',
          created_by_id: actor?.id,
          created_by_name: actor?.name
        });
        setMessage({ text: 'Pembayaran kasbon berhasil dicatat.', error: false });
      }
      resetForm();
      loadData();
    } catch (error: any) {
      setMessage({ text: error.message || 'Gagal menyimpan kasbon.', error: true });
    }
  };

  const selectedTransactions = transactions
    .filter(transaction => !selectedEmployeeId || transaction.employee_id === selectedEmployeeId)
    .slice(0, 80);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Total Sisa Kasbon</p>
          <p className="mt-1 text-xl font-black text-rose-700 font-mono">{formatIDR(totalOutstanding)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Karyawan Dipilih</p>
          <p className="mt-1 text-sm font-black text-gray-900">{selectedEmployee?.name || 'Belum dipilih'}</p>
          <p className="text-xs text-rose-700 font-mono">{formatIDR(selectedOutstanding)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Transaksi Kasbon</p>
          <p className="mt-1 text-xl font-black text-[#1F4B36] font-mono">{transactions.length}</p>
        </div>
      </div>

      {message && <p className={`rounded-lg border p-3 text-sm ${message.error ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>{message.text}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <form onSubmit={handleSubmit} className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div>
            <h3 className="font-black text-gray-900 flex items-center gap-2"><WalletCards className="w-4 h-4 text-[#1F4B36]" /> Kelola Kasbon</h3>
            <p className="text-xs text-gray-500 mt-1">Catat kasbon baru, tambah saldo, atau pembayaran manual.</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'create', label: 'Kasbon Baru', icon: Plus },
              { id: 'topup', label: 'Tambah Saldo', icon: RefreshCw },
              { id: 'payment', label: 'Pembayaran', icon: CreditCard },
            ] as const).map(item => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => { setMode(item.id); resetForm(); }} className={`py-2 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 ${mode === item.id ? 'bg-[#1F4B36] text-white border-[#1F4B36]' : 'bg-white text-gray-600 border-gray-200'}`}><Icon className="w-3.5 h-3.5" />{item.label}</button>;
            })}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Karyawan</label>
            <select value={selectedEmployeeId} onChange={event => { setSelectedEmployeeId(event.target.value); setSelectedAdvanceId(''); }} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" required>
              <option value="">Pilih karyawan</option>
              {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </div>

          {mode === 'topup' && (
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Kasbon Aktif</label>
              <select value={selectedAdvanceId} onChange={event => setSelectedAdvanceId(event.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" required>
                <option value="">Pilih kasbon</option>
                {activeAdvances.map(advance => <option key={advance.id} value={advance.id}>{advance.date} - Sisa {formatIDR(advance.remaining_balance)}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Tanggal</label><input type="date" value={date} onChange={event => setDate(event.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" required /></div>
            <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Nominal</label><input type="number" min={1} value={amount} onChange={event => setAmount(Number(event.target.value))} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-mono font-bold" required /></div>
          </div>

          <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Catatan</label><textarea value={note} onChange={event => setNote(event.target.value)} rows={3} placeholder="Contoh: kasbon bahan pokok, pembayaran tunai, koreksi saldo" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" /></div>

          <button type="submit" className="w-full bg-[#1F4B36] text-white rounded-lg py-2.5 text-sm font-bold">Simpan Kasbon</button>
        </form>

        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div>
              <h3 className="font-black text-gray-900">Saldo Kasbon Karyawan</h3>
              <p className="text-xs text-gray-500">Klik karyawan untuk melihat riwayatnya.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari karyawan..." className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
            {employeesWithBalance.map(({ employee, balance }) => (
              <button key={employee.id} type="button" onClick={() => setSelectedEmployeeId(employee.id)} className={`text-left p-3 rounded-lg border ${selectedEmployeeId === employee.id ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                <p className="text-sm font-bold text-gray-900">{employee.name}</p>
                <p className="text-[10px] text-gray-500">@{employee.username}</p>
                <p className={`mt-1 text-xs font-mono font-black ${balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatIDR(balance)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-black text-gray-900">Riwayat Transaksi Kasbon</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr><th className="p-2 text-left">Tanggal</th><th className="p-2 text-left">Karyawan</th><th className="p-2 text-left">Jenis</th><th className="p-2 text-right">Nominal</th><th className="p-2 text-left">Catatan</th></tr></thead>
            <tbody>
              {selectedTransactions.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-gray-400">Belum ada transaksi kasbon.</td></tr> : selectedTransactions.map(transaction => (
                <tr key={transaction.id} className="border-t border-gray-100">
                  <td className="p-2 font-mono">{transaction.date}</td>
                  <td className="p-2 font-bold text-gray-800">{transaction.employee_name}</td>
                  <td className="p-2 capitalize">{transaction.type === 'create' ? 'Kasbon Baru' : transaction.type === 'topup' ? 'Tambah Saldo' : transaction.type === 'deduction' ? 'Potongan Gaji' : transaction.type === 'payment' ? 'Pembayaran' : 'Koreksi'}</td>
                  <td className="p-2 text-right font-mono font-black">{formatIDR(transaction.amount)}</td>
                  <td className="p-2 text-gray-500">{transaction.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
