import React, { useEffect, useMemo, useState } from 'react';
import { CashAdvance, CashAdvanceTransaction, Employee } from '../types';
import { dataStore, wibTodayStr } from '../dataStore';
import { CreditCard, Plus, RefreshCw, Search, WalletCards, X } from 'lucide-react';

interface CashAdvanceModuleProps {
  actor?: Employee | null;
}

const formatIDR = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;

const transactionLabel = (type: CashAdvanceTransaction['type']) => (
  type === 'create' ? 'Kasbon Baru'
    : type === 'topup' ? 'Tambah Saldo'
      : type === 'deduction' ? 'Potongan Gaji'
        : type === 'payment' ? 'Pembayaran'
          : 'Koreksi'
);

const transactionTone = (type: CashAdvanceTransaction['type']) => (
  type === 'create' || type === 'topup'
    ? 'bg-rose-50 text-rose-700 border-rose-100'
    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
);

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
  const [transactionFilter, setTransactionFilter] = useState<'all' | CashAdvanceTransaction['type']>('all');
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
  const employeesWithOutstanding = employees.filter(employee => advances.some(advance => advance.employee_id === employee.id && advance.remaining_balance > 0)).length;
  const paymentTotal = transactions
    .filter(transaction => transaction.type === 'payment' || transaction.type === 'deduction')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const employeesWithBalance = useMemo(() => employees.map(employee => {
    const balance = advances.filter(advance => advance.employee_id === employee.id).reduce((sum, advance) => sum + advance.remaining_balance, 0);
    return { employee, balance };
  })
    .filter(item => !search.trim() || `${item.employee.name} ${item.employee.username}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.balance - a.balance || a.employee.name.localeCompare(b.employee.name)), [employees, advances, search]);
  const modeOptions = [
    { id: 'create', label: 'Kasbon Baru', title: 'Catat Kasbon Baru', description: 'Dipakai saat karyawan mengambil kasbon baru.', icon: Plus, submit: 'Catat Kasbon Baru' },
    { id: 'topup', label: 'Tambah Saldo', title: 'Tambah Saldo Kasbon', description: 'Dipakai untuk menambah nominal kasbon yang masih aktif.', icon: RefreshCw, submit: 'Tambah Saldo' },
    { id: 'payment', label: 'Pembayaran', title: 'Catat Pembayaran Manual', description: 'Dipakai jika karyawan membayar kasbon di luar potongan gaji.', icon: CreditCard, submit: 'Catat Pembayaran' },
  ] as const;
  const activeMode = modeOptions.find(option => option.id === mode) || modeOptions[0];
  const submitDisabled = !selectedEmployeeId || amount <= 0 || (mode === 'topup' && !selectedAdvanceId) || ((mode === 'topup' || mode === 'payment') && selectedOutstanding <= 0);

  const selectEmployeeForMode = (employeeId: string, nextMode?: typeof mode) => {
    setSelectedEmployeeId(employeeId);
    const firstActiveAdvance = advances.find(advance => advance.employee_id === employeeId && advance.remaining_balance > 0);
    setSelectedAdvanceId(nextMode === 'topup' && firstActiveAdvance ? firstActiveAdvance.id : '');
    if (nextMode) setMode(nextMode);
  };

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
    .filter(transaction => transactionFilter === 'all' || transaction.type === transactionFilter)
    .slice(0, 80);

  const clearSelection = () => {
    setSelectedEmployeeId('');
    setSelectedAdvanceId('');
    setMode('create');
    setSearch('');
    setTransactionFilter('all');
    resetForm();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Total Sisa Kasbon</p>
          <p className="mt-1 text-xl font-black text-rose-700 font-mono">{formatIDR(totalOutstanding)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Karyawan Dipilih</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-sm font-black text-gray-900">{selectedEmployee?.name || 'Belum dipilih'}</p>
            {selectedEmployee && (
              <button type="button" onClick={clearSelection} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer" title="Bersihkan pilihan">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-xs text-rose-700 font-mono">{formatIDR(selectedOutstanding)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Pembayaran Tercatat</p>
          <p className="mt-1 text-xl font-black text-[var(--color-evergreen)] font-mono">{formatIDR(paymentTotal)}</p>
          <p className="text-[11px] text-gray-500">{employeesWithOutstanding} karyawan masih punya saldo</p>
        </div>
      </div>

      {message && <p className={`rounded-lg border p-3 text-sm ${message.error ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>{message.text}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <form onSubmit={handleSubmit} className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div>
            <h3 className="font-black text-gray-900 flex items-center gap-2"><WalletCards className="w-4 h-4 text-[var(--color-evergreen)]" /> {activeMode.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{activeMode.description}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {modeOptions.map(item => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => { setMode(item.id); resetForm(); }} className={`min-h-12 px-2 py-2 rounded-lg text-[11px] font-bold border flex flex-col sm:flex-row items-center justify-center gap-1 leading-tight ${mode === item.id ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}><Icon className="w-3.5 h-3.5 shrink-0" />{item.label}</button>;
            })}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Karyawan</label>
            <select value={selectedEmployeeId} onChange={event => { setSelectedEmployeeId(event.target.value); setSelectedAdvanceId(''); }} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" required>
              <option value="">Pilih karyawan</option>
              {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </div>

          {selectedEmployee && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-gray-900">{selectedEmployee.name}</span>
                <span className={`font-mono font-black ${selectedOutstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatIDR(selectedOutstanding)}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">{activeAdvances.length} kasbon aktif. Potongan gaji otomatis tetap dicatat dari generate slip.</p>
            </div>
          )}

          {mode === 'topup' && (
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Kasbon Aktif</label>
              <select value={selectedAdvanceId} onChange={event => setSelectedAdvanceId(event.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" required>
                <option value="">Pilih kasbon</option>
                {activeAdvances.map(advance => <option key={advance.id} value={advance.id}>{advance.date} - Sisa {formatIDR(advance.remaining_balance)}</option>)}
              </select>
            </div>
          )}

          {(mode === 'topup' || mode === 'payment') && selectedEmployeeId && selectedOutstanding <= 0 && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-2.5 text-[11px] text-amber-800">Karyawan ini belum punya sisa kasbon aktif. Gunakan mode Kasbon Baru jika ingin membuat saldo baru.</p>
          )}

          {selectedEmployee && activeAdvances.length > 0 && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-500 mb-2">Kasbon Aktif</p>
              <div className="space-y-1.5">
                {activeAdvances.map(advance => (
                  <button
                    key={advance.id}
                    type="button"
                    onClick={() => {
                      setMode('topup');
                      setSelectedAdvanceId(advance.id);
                    }}
                    className={`w-full rounded-md border px-2.5 py-2 text-left text-[11px] cursor-pointer ${selectedAdvanceId === advance.id ? 'bg-white border-emerald-300' : 'bg-white/70 border-gray-100 hover:border-emerald-200'}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-700">{advance.date}</span>
                      <span className="font-mono font-black text-rose-700">{formatIDR(advance.remaining_balance)}</span>
                    </span>
                    {advance.note && <span className="mt-0.5 block text-gray-500">{advance.note}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Tanggal</label><input type="date" value={date} onChange={event => setDate(event.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" required /></div>
            <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Nominal</label><input type="number" min={1} value={amount} onChange={event => setAmount(Number(event.target.value))} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-mono font-bold" required /></div>
          </div>

          <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Catatan</label><textarea value={note} onChange={event => setNote(event.target.value)} rows={3} placeholder="Contoh: kasbon bahan pokok, pembayaran tunai, koreksi saldo" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" /></div>

          <button type="submit" disabled={submitDisabled} className={`w-full rounded-lg py-2.5 text-sm font-bold ${submitDisabled ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[var(--color-evergreen)] text-white cursor-pointer hover:bg-emerald-900'}`}>{activeMode.submit}</button>
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
          {employeesWithBalance.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">Karyawan tidak ditemukan.</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {employeesWithBalance.map(({ employee, balance }) => (
              <div key={employee.id} className={`text-left p-3 rounded-lg border ${selectedEmployeeId === employee.id ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'}`}>
                <button type="button" onClick={() => selectEmployeeForMode(employee.id)} className="w-full text-left cursor-pointer">
                  <p className="text-sm font-bold text-gray-900">{employee.name}</p>
                  <p className="text-[10px] text-gray-500">@{employee.username}</p>
                  <p className={`mt-1 text-xs font-mono font-black ${balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{balance > 0 ? formatIDR(balance) : 'Tidak ada sisa'}</p>
                </button>
                <div className="mt-2 flex gap-1.5">
                  <button type="button" onClick={() => selectEmployeeForMode(employee.id, balance > 0 ? 'topup' : 'create')} className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-black text-gray-700 hover:bg-gray-50 cursor-pointer">{balance > 0 ? 'Tambah' : 'Kasbon Baru'}</button>
                  <button type="button" onClick={() => selectEmployeeForMode(employee.id, 'payment')} disabled={balance <= 0} className={`flex-1 rounded border px-2 py-1 text-[10px] font-black ${balance > 0 ? 'border-emerald-100 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer' : 'border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed'}`}>Bayar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-black text-gray-900">Riwayat Transaksi Kasbon</h3>
            <p className="text-xs text-gray-500">{selectedEmployee ? `Menampilkan transaksi ${selectedEmployee.name}` : 'Menampilkan seluruh transaksi terbaru'}</p>
          </div>
          <select value={transactionFilter} onChange={event => setTransactionFilter(event.target.value as typeof transactionFilter)} className="border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700">
            <option value="all">Semua Jenis</option>
            <option value="create">Kasbon Baru</option>
            <option value="topup">Tambah Saldo</option>
            <option value="deduction">Potongan Gaji</option>
            <option value="payment">Pembayaran</option>
            <option value="adjustment">Koreksi</option>
          </select>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr><th className="p-2 text-left">Tanggal</th><th className="p-2 text-left">Karyawan</th><th className="p-2 text-left">Jenis</th><th className="p-2 text-right">Nominal</th><th className="p-2 text-left">Catatan</th></tr></thead>
            <tbody>
              {selectedTransactions.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-gray-400">Belum ada transaksi kasbon.</td></tr> : selectedTransactions.map(transaction => (
                <tr key={transaction.id} className="border-t border-gray-100">
                  <td className="p-2 font-mono">{transaction.date}</td>
                  <td className="p-2 font-bold text-gray-800">{transaction.employee_name}</td>
                  <td className="p-2"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${transactionTone(transaction.type)}`}>{transactionLabel(transaction.type)}</span></td>
                  <td className={`p-2 text-right font-mono font-black ${transaction.type === 'create' || transaction.type === 'topup' ? 'text-rose-700' : 'text-emerald-700'}`}>{formatIDR(transaction.amount)}</td>
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
