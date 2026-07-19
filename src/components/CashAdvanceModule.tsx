import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CashAdvance, CashAdvanceTransaction, Employee } from '../types';
import { dataStore, wibTodayStr } from '../dataStore';
import { Check, CreditCard, History, Plus, RefreshCw, Search, Users, WalletCards, X } from 'lucide-react';

interface CashAdvanceModuleProps {
  actor?: Employee | null;
}

const formatIDR = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;

const formatDateID = (value: string) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

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

type FormMode = 'create' | 'topup' | 'payment';

export const CashAdvanceModule: React.FC<CashAdvanceModuleProps> = ({ actor }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<CashAdvance[]>([]);
  const [transactions, setTransactions] = useState<CashAdvanceTransaction[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [search, setSearch] = useState('');
  const [transactionFilter, setTransactionFilter] = useState<'all' | CashAdvanceTransaction['type']>('all');
  const [viewTab, setViewTab] = useState<'saldo' | 'riwayat'>('saldo');

  // Form popup
  const [showFormModal, setShowFormModal] = useState(false);
  const [mode, setMode] = useState<FormMode>('create');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formEmployeeSearch, setFormEmployeeSearch] = useState('');
  const [selectedAdvanceId, setSelectedAdvanceId] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(wibTodayStr());
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const successTimer = useRef<number | undefined>(undefined);

  const loadData = () => {
    setEmployees(dataStore.getEmployees().filter(employee => employee.status_aktif));
    setAdvances(dataStore.getCashAdvances());
    setTransactions(dataStore.getCashAdvanceTransactions());
  };

  useEffect(() => {
    loadData();
    const handleStorageChange = () => loadData();
    window.addEventListener('nxty_storage_change', handleStorageChange);
    return () => {
      window.removeEventListener('nxty_storage_change', handleStorageChange);
      if (successTimer.current) window.clearTimeout(successTimer.current);
    };
  }, []);

  const outstandingFor = (employeeId: string) =>
    advances.filter(advance => advance.employee_id === employeeId && advance.remaining_balance > 0)
      .reduce((sum, advance) => sum + advance.remaining_balance, 0);

  const totalOutstanding = advances.reduce((sum, advance) => sum + advance.remaining_balance, 0);
  const employeesWithOutstanding = employees.filter(employee => outstandingFor(employee.id) > 0).length;
  const paymentTotal = transactions
    .filter(transaction => transaction.type === 'payment' || transaction.type === 'deduction')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const employeesWithBalance = useMemo(() => employees.map(employee => {
    const activeList = advances.filter(advance => advance.employee_id === employee.id && advance.remaining_balance > 0);
    const balance = activeList.reduce((sum, advance) => sum + advance.remaining_balance, 0);
    return { employee, balance, activeCount: activeList.length };
  })
    .filter(item => !search.trim() || `${item.employee.name} ${item.employee.username}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.balance - a.balance || a.employee.name.localeCompare(b.employee.name)), [employees, advances, search]);

  const selectedEmployee = employees.find(employee => employee.id === selectedEmployeeId);

  // Data untuk karyawan yang sedang diisi di form popup
  const formEmployee = employees.find(employee => employee.id === formEmployeeId);
  const formActiveAdvances = advances.filter(advance => advance.employee_id === formEmployeeId && advance.remaining_balance > 0);
  const formOutstanding = formActiveAdvances.reduce((sum, advance) => sum + advance.remaining_balance, 0);

  const modeOptions = [
    { id: 'create', label: 'Kasbon Baru', title: 'Catat Kasbon Baru', description: 'Dipakai saat karyawan mengambil kasbon baru.', icon: Plus, submit: 'Catat Kasbon Baru' },
    { id: 'topup', label: 'Tambah Saldo', title: 'Tambah Saldo Kasbon', description: 'Dipakai untuk menambah nominal kasbon yang masih aktif.', icon: RefreshCw, submit: 'Tambah Saldo' },
    { id: 'payment', label: 'Pembayaran', title: 'Catat Pembayaran Manual', description: 'Dipakai jika karyawan membayar kasbon di luar potongan gaji.', icon: CreditCard, submit: 'Catat Pembayaran' },
  ] as const;
  const activeMode = modeOptions.find(option => option.id === mode) || modeOptions[0];

  const submitBlocker = !formEmployeeId ? 'Pilih karyawan terlebih dahulu.'
    : (mode === 'topup' || mode === 'payment') && formOutstanding <= 0 ? 'Karyawan ini belum punya sisa kasbon aktif.'
      : mode === 'topup' && !selectedAdvanceId ? 'Pilih kasbon aktif yang akan ditambah.'
        : amount <= 0 ? 'Isi nominal transaksi.'
          : '';

  const flashSuccess = (text: string) => {
    setSuccessMessage(text);
    if (successTimer.current) window.clearTimeout(successTimer.current);
    successTimer.current = window.setTimeout(() => setSuccessMessage(''), 6000);
  };

  const openForm = (employeeId: string, nextMode: FormMode) => {
    setFormEmployeeId(employeeId);
    setMode(nextMode);
    const firstActiveAdvance = advances.find(advance => advance.employee_id === employeeId && advance.remaining_balance > 0);
    setSelectedAdvanceId(nextMode === 'topup' && firstActiveAdvance ? firstActiveAdvance.id : '');
    setAmount(0);
    setNote('');
    setDate(wibTodayStr());
    setFormError('');
    setFormEmployeeSearch('');
    setShowFormModal(true);
  };

  const closeForm = () => {
    setShowFormModal(false);
    setFormError('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    try {
      if (!formEmployeeId) throw new Error('Pilih karyawan terlebih dahulu.');
      if (mode === 'create') {
        dataStore.createCashAdvance({
          employee_id: formEmployeeId,
          amount,
          date,
          note: note.trim() || undefined,
          created_by_id: actor?.id,
          created_by_name: actor?.name
        });
        flashSuccess(`Kasbon baru ${formatIDR(amount)} untuk ${formEmployee?.name || 'karyawan'} berhasil dicatat.`);
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
        flashSuccess(`Saldo kasbon ${formEmployee?.name || 'karyawan'} berhasil ditambah ${formatIDR(amount)}.`);
      } else {
        dataStore.applyCashAdvancePayment({
          employee_id: formEmployeeId,
          amount,
          type: 'payment',
          date,
          note: note.trim() || 'Pembayaran kasbon manual',
          created_by_id: actor?.id,
          created_by_name: actor?.name
        });
        flashSuccess(`Pembayaran kasbon ${formatIDR(amount)} dari ${formEmployee?.name || 'karyawan'} berhasil dicatat.`);
      }
      setSelectedEmployeeId(formEmployeeId);
      setShowFormModal(false);
      loadData();
    } catch (error: any) {
      setFormError(error.message || 'Gagal menyimpan kasbon.');
    }
  };

  const TRANSACTION_LIMIT = 80;
  const filteredTransactions = transactions
    .filter(transaction => !selectedEmployeeId || transaction.employee_id === selectedEmployeeId)
    .filter(transaction => transactionFilter === 'all' || transaction.type === transactionFilter);
  const selectedTransactions = filteredTransactions.slice(0, TRANSACTION_LIMIT);

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="bg-[var(--color-evergreen)] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span className="bg-white/15 p-2 rounded-xl"><WalletCards className="w-5 h-5 text-amber-300" /></span> Kasbon Karyawan
          </h2>
          <p className="text-xs text-emerald-50/80 mt-1.5">Catat kasbon baru, tambah saldo, dan pembayaran manual. Potongan gaji otomatis tercatat dari generate slip.</p>
        </div>
        <button
          type="button"
          onClick={() => openForm(selectedEmployeeId, 'create')}
          className="bg-white hover:bg-emerald-50 text-[var(--color-evergreen)] px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" /> Catat Transaksi
        </button>
      </div>

      {/* KARTU STATISTIK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 flex items-center gap-4">
          <div className="bg-rose-600 text-white p-3 rounded-xl shadow-2xs">
            <WalletCards className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-rose-800">Total Sisa Kasbon</p>
            <p className="mt-1 text-xl font-black text-rose-700 font-mono">{formatIDR(totalOutstanding)}</p>
          </div>
        </div>
        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex items-center gap-4">
          <div className="bg-amber-600 text-white p-3 rounded-xl shadow-2xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-800">Karyawan Punya Sisa</p>
            <p className="mt-1 text-xl font-black text-amber-950 font-mono">{employeesWithOutstanding} <span className="text-xs font-sans font-medium text-gray-500">dari {employees.length} karyawan</span></p>
          </div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4">
          <div className="bg-[var(--color-evergreen)] text-white p-3 rounded-xl shadow-2xs">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-800">Pembayaran Tercatat</p>
            <p className="mt-1 text-xl font-black text-[var(--color-evergreen)] font-mono">{formatIDR(paymentTotal)}</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <p className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" /> {successMessage}
        </p>
      )}

      {/* TAB NAVIGASI */}
      <div className="flex bg-gray-50 p-1.5 rounded-xl border-2 border-[var(--color-evergreen)]/30 w-fit gap-1">
        <button
          type="button"
          onClick={() => setViewTab('saldo')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${viewTab === 'saldo' ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)] shadow-2xs' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800 hover:border-[var(--color-evergreen)]/40'}`}
        >
          <Users className="w-3.5 h-3.5" />
          1. Saldo Karyawan
        </button>
        <button
          type="button"
          onClick={() => setViewTab('riwayat')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${viewTab === 'riwayat' ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)] shadow-2xs' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800 hover:border-[var(--color-evergreen)]/40'}`}
        >
          <History className="w-3.5 h-3.5" />
          2. Riwayat Transaksi
        </button>
      </div>

      {/* TABEL SALDO KARYAWAN */}
      {viewTab === 'saldo' && (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div>
            <h3 className="font-black text-gray-900 text-sm">Saldo Kasbon Karyawan</h3>
            <p className="text-xs text-gray-500">Klik baris untuk membuka riwayat transaksi karyawan tersebut.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari karyawan..." className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs w-full sm:w-64" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-evergreen)] text-white uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="p-3 text-center w-10 border-r border-white/10">No</th>
                <th className="p-3 text-left border-r border-white/10">Karyawan</th>
                <th className="p-3 text-center w-28 border-r border-white/10">Kasbon Aktif</th>
                <th className="p-3 text-right w-40 border-r border-white/10">Sisa Kasbon</th>
                <th className="p-3 text-center w-28 border-r border-white/10">Status</th>
                <th className="p-3 text-center w-56">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {employeesWithBalance.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Karyawan tidak ditemukan.</td></tr>
              ) : employeesWithBalance.map(({ employee, balance, activeCount }, index) => (
                <tr
                  key={employee.id}
                  onClick={() => { setSelectedEmployeeId(employee.id); setViewTab('riwayat'); }}
                  className={`border-t border-gray-100 cursor-pointer transition-colors ${selectedEmployeeId === employee.id ? 'bg-emerald-50/70' : 'hover:bg-gray-50'}`}
                >
                  <td className="p-3 text-center text-gray-400">{index + 1}</td>
                  <td className="p-3">
                    <p className="font-bold text-gray-900">{employee.name}</p>
                    <p className="text-[10px] text-gray-400">@{employee.username}</p>
                  </td>
                  <td className="p-3 text-center text-gray-600">{activeCount > 0 ? `${activeCount} kasbon` : '-'}</td>
                  <td className={`p-3 text-right font-mono font-black ${balance > 0 ? 'text-rose-700' : 'text-gray-400'}`}>{balance > 0 ? formatIDR(balance) : '-'}</td>
                  <td className="p-3 text-center">
                    {balance > 0 ? (
                      <span className="inline-flex rounded-full border border-rose-100 bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-700 uppercase">Ada Sisa</span>
                    ) : (
                      <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 uppercase">Lunas</span>
                    )}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap" onClick={event => event.stopPropagation()}>
                    <div className="inline-flex gap-1.5">
                      {balance > 0 ? (
                        <>
                          <button type="button" onClick={() => openForm(employee.id, 'topup')} className="rounded border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-black text-gray-700 hover:bg-gray-50 cursor-pointer">Tambah</button>
                          <button type="button" onClick={() => openForm(employee.id, 'payment')} className="rounded border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800 hover:bg-emerald-100 cursor-pointer">Bayar</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => openForm(employee.id, 'create')} className="rounded border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-black text-gray-700 hover:bg-gray-50 cursor-pointer">Kasbon Baru</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* RIWAYAT TRANSAKSI */}
      {viewTab === 'riwayat' && (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-black text-gray-900">Riwayat Transaksi Kasbon</h3>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              {selectedEmployee ? (
                <>
                  Menampilkan transaksi {selectedEmployee.name}
                  <button type="button" onClick={() => setSelectedEmployeeId('')} className="inline-flex items-center gap-0.5 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 hover:bg-gray-50 cursor-pointer">
                    <X className="w-2.5 h-2.5" /> Semua
                  </button>
                </>
              ) : 'Menampilkan seluruh transaksi terbaru'}
            </p>
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
            <thead className="bg-[var(--color-evergreen)] text-white uppercase text-[10px] font-bold tracking-wider"><tr><th className="p-3 text-left border-r border-white/10">Tanggal</th><th className="p-3 text-left border-r border-white/10">Karyawan</th><th className="p-3 text-left border-r border-white/10">Jenis</th><th className="p-3 text-right border-r border-white/10">Nominal</th><th className="p-3 text-left">Catatan</th></tr></thead>
            <tbody>
              {selectedTransactions.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-gray-400">Belum ada transaksi kasbon.</td></tr> : selectedTransactions.map(transaction => (
                <tr key={transaction.id} className="border-t border-gray-100">
                  <td className="p-2 font-mono whitespace-nowrap">{formatDateID(transaction.date)}</td>
                  <td className="p-2 font-bold text-gray-800">{transaction.employee_name}</td>
                  <td className="p-2"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${transactionTone(transaction.type)}`}>{transactionLabel(transaction.type)}</span></td>
                  <td className={`p-2 text-right font-mono font-black ${transaction.type === 'create' || transaction.type === 'topup' ? 'text-rose-700' : 'text-emerald-700'}`}>{formatIDR(transaction.amount)}</td>
                  <td className="p-2 text-gray-500">{transaction.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredTransactions.length > TRANSACTION_LIMIT && (
          <p className="mt-2 text-[10px] text-gray-400 text-center">Menampilkan {TRANSACTION_LIMIT} transaksi terbaru dari {filteredTransactions.length}. Gunakan filter untuk mempersempit.</p>
        )}
      </div>
      )}

      {/* POPUP FORM TRANSAKSI */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <WalletCards className="w-4 h-4" /> {activeMode.title}
                </h3>
                <p className="text-[10px] text-gray-400 mt-1">{activeMode.description}</p>
              </div>
              <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {modeOptions.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setMode(item.id);
                        const firstActiveAdvance = advances.find(advance => advance.employee_id === formEmployeeId && advance.remaining_balance > 0);
                        setSelectedAdvanceId(item.id === 'topup' && firstActiveAdvance ? firstActiveAdvance.id : '');
                        setFormError('');
                      }}
                      className={`min-h-12 px-2 py-2 rounded-lg text-[11px] font-bold border flex flex-col sm:flex-row items-center justify-center gap-1 leading-tight cursor-pointer ${mode === item.id ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />{item.label}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Karyawan</label>
                <input
                  type="text"
                  value={formEmployeeSearch}
                  onChange={event => setFormEmployeeSearch(event.target.value)}
                  placeholder="Cari nama karyawan..."
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm mb-1.5"
                />
                <select
                  value={formEmployeeId}
                  onChange={event => {
                    const employeeId = event.target.value;
                    setFormEmployeeId(employeeId);
                    const firstActiveAdvance = advances.find(advance => advance.employee_id === employeeId && advance.remaining_balance > 0);
                    setSelectedAdvanceId(mode === 'topup' && firstActiveAdvance ? firstActiveAdvance.id : '');
                  }}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                  required
                >
                  <option value="">Pilih karyawan</option>
                  {employees
                    .filter(employee => employee.name.toLowerCase().includes(formEmployeeSearch.trim().toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                </select>
              </div>

              {formEmployee && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-gray-900">{formEmployee.name}</span>
                    <span className={`font-mono font-black ${formOutstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>Sisa {formatIDR(formOutstanding)}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{formActiveAdvances.length} kasbon aktif. Potongan gaji otomatis tetap dicatat dari generate slip.</p>
                </div>
              )}

              {mode === 'topup' && formActiveAdvances.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Kasbon Aktif yang Ditambah</label>
                  <div className="space-y-1.5">
                    {formActiveAdvances.map(advance => (
                      <button
                        key={advance.id}
                        type="button"
                        onClick={() => setSelectedAdvanceId(advance.id)}
                        className={`w-full rounded-md border px-2.5 py-2 text-left text-[11px] cursor-pointer ${selectedAdvanceId === advance.id ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200 hover:border-emerald-200'}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-bold text-gray-700">{formatDateID(advance.date)}</span>
                          <span className="font-mono font-black text-rose-700">Sisa {formatIDR(advance.remaining_balance)}</span>
                        </span>
                        {advance.note && <span className="mt-0.5 block text-gray-500">{advance.note}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(mode === 'topup' || mode === 'payment') && formEmployeeId && formOutstanding <= 0 && (
                <p className="rounded-lg border border-amber-100 bg-amber-50 p-2.5 text-[11px] text-amber-800">Karyawan ini belum punya sisa kasbon aktif. Gunakan mode Kasbon Baru jika ingin membuat saldo baru.</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Tanggal</label>
                  <input type="date" value={date} onChange={event => setDate(event.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Nominal</label>
                  <input type="number" min={1} value={amount || ''} onChange={event => setAmount(Number(event.target.value))} placeholder="0" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-mono font-bold" required />
                  {amount > 0 && <p className="mt-1 text-[11px] font-bold text-[var(--color-evergreen)] font-mono">{formatIDR(amount)}</p>}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Catatan</label>
                <textarea value={note} onChange={event => setNote(event.target.value)} rows={2} placeholder="Contoh: kasbon bahan pokok, pembayaran tunai" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" />
              </div>

              {formError && <p className="rounded-lg border border-rose-100 bg-rose-50 p-2.5 text-xs text-rose-700">{formError}</p>}
              {!formError && submitBlocker && <p className="text-[11px] text-gray-400">{submitBlocker}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeForm} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 cursor-pointer">Batal</button>
                <button
                  type="submit"
                  disabled={!!submitBlocker}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${submitBlocker ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[var(--color-evergreen)] text-white cursor-pointer hover:bg-[var(--color-evergreen-dark)]'}`}
                >
                  {activeMode.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
