import React, { useEffect, useMemo, useState } from 'react';
import { CloudUpload, HardDrive, History, RotateCcw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { dataStore } from '../dataStore';
import { AuditEntry, RecycleEntry } from '../types';
import { findLegacyProofPhotos, migrateLegacyProofPhotos, STORAGE_BUDGET_BYTES, LegacyProofPhoto } from '../storageMaintenance';

const formatBytes = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(0, Math.round(bytes / 1024))} KB`;

export const AuditRecycleModule: React.FC = () => {
  const [tab, setTab] = useState<'audit' | 'recycle'>('audit');
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [recycle, setRecycle] = useState<RecycleEntry[]>([]);
  const [query, setQuery] = useState('');
  // Panel penyimpanan: localStorage hanya ±5 MB di iPhone, sedangkan aplikasi ini
  // dipakai harian dan terus bertambah. Pemakaian harus terlihat sebelum penuh.
  const [usage, setUsage] = useState(() => dataStore.getStorageUsage());
  const [legacyProofs, setLegacyProofs] = useState<LegacyProofPhoto[]>([]);
  const [busyStorage, setBusyStorage] = useState(false);
  const load = () => {
    setLogs(dataStore.getAuditLogs());
    setRecycle(dataStore.getRecycleBin());
    setUsage(dataStore.getStorageUsage());
    setLegacyProofs(findLegacyProofPhotos());
  };

  const pakaiPersen = Math.min(100, Math.round((usage.totalBytes / STORAGE_BUDGET_BYTES) * 100));

  const pindahkanFotoLama = async () => {
    if (busyStorage || legacyProofs.length === 0) return;
    const total = legacyProofs.reduce((sum, item) => sum + item.bytes, 0);
    if (!window.confirm(`Pindahkan ${legacyProofs.length} foto bukti pengiriman (${formatBytes(total)}) dari cache perangkat ke cloud?\n\nFoto tetap tampil di aplikasi, hanya disimpan sebagai tautan — tidak lagi menumpuk di penyimpanan browser.`)) return;
    setBusyStorage(true);
    try {
      const hasil = await migrateLegacyProofPhotos();
      load();
      window.alert(hasil.failed === 0
        ? `${hasil.moved} foto dipindahkan ke cloud. Penyimpanan browser menyusut ±${formatBytes(hasil.freedBytes)}.`
        : `${hasil.moved} foto berhasil dipindahkan, ${hasil.failed} gagal — periksa koneksi lalu coba lagi.`);
    } finally {
      setBusyStorage(false);
    }
  };

  const buangCacheAman = () => {
    if (!window.confirm('Buang cache audit log & recycle bin di perangkat ini?\n\nData aslinya tetap ada di cloud dan ditarik ulang saat aplikasi dibuka kembali.')) return;
    const freed = dataStore.clearCacheOnlyKeys();
    load();
    window.alert(`Cache dibuang. Penyimpanan browser bebas ±${formatBytes(freed)}.`);
  };
  useEffect(() => { load(); window.addEventListener('nxty_storage_change', load); return () => window.removeEventListener('nxty_storage_change', load); }, []);

  const filteredLogs = useMemo(() => logs.filter(log => `${log.actor_name} ${log.action} ${log.entity_type} ${log.description}`.toLowerCase().includes(query.toLowerCase())), [logs, query]);
  const filteredRecycle = useMemo(() => recycle.filter(item => `${item.label} ${item.entity_type} ${item.deleted_by_name}`.toLowerCase().includes(query.toLowerCase())), [recycle, query]);
  const formatTime = (value: string) => new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  const restore = (item: RecycleEntry) => {
    if (!window.confirm(`Pulihkan "${item.label}" ke data aktif?`)) return;
    try { dataStore.restoreRecycleEntry(item.id); load(); } catch (error: any) { window.alert(error.message || 'Gagal memulihkan data.'); }
  };
  const removeForever = (item: RecycleEntry) => {
    if (!window.confirm(`Hapus permanen "${item.label}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    dataStore.permanentlyDeleteRecycleEntry(item.id); load();
  };
  const emptyAll = () => {
    if (recycle.length === 0) return;
    if (!window.confirm(`Kosongkan seluruh Recycle Bin (${recycle.length} entri)? Semua data terhapus akan hilang permanen dan tidak dapat dipulihkan.`)) return;
    if (!window.confirm('Konfirmasi terakhir: yakin kosongkan recycle bin?')) return;
    dataStore.emptyRecycleBin(); load();
  };

  return <div className="space-y-5">
    <div><h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[var(--color-evergreen)]" /> Audit & Recycle Bin</h2><p className="text-xs text-gray-500 mt-1">Riwayat kegiatan penting dan data terhapus yang dapat dipulihkan selama 30 hari.</p></div>

    {/* PENYIMPANAN LOKAL — data asli ada di cloud, localStorage cuma cache.
        Batasnya ±5 MB (iOS Safari), jadi pemakaian harus terlihat sebelum penuh. */}
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2"><HardDrive className="w-4 h-4 text-[var(--color-evergreen)]" /> Penyimpanan di Perangkat Ini</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Data asli tersimpan di cloud. Yang ini hanya cache supaya aplikasi cepat dibuka.</p>
        </div>
        <span className={`text-xs font-bold font-mono ${pakaiPersen >= 85 ? 'text-rose-600' : pakaiPersen >= 70 ? 'text-amber-600' : 'text-emerald-700'}`}>
          {formatBytes(usage.totalBytes)} / {formatBytes(STORAGE_BUDGET_BYTES)} ({pakaiPersen}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full transition-all ${pakaiPersen >= 85 ? 'bg-rose-500' : pakaiPersen >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pakaiPersen}%` }} />
      </div>
      {pakaiPersen >= 70 && (
        <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Penyimpanan browser sudah terisi {pakaiPersen}%. Jalankan aksi di bawah supaya input baru tetap tersimpan lancar (data tetap aman di cloud).
        </p>
      )}
      {usage.perKey.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {usage.perKey.slice(0, 6).map(item => (
            <span key={item.key} className="text-[10px] font-mono text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1">
              {item.key} · {formatBytes(item.bytes)}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {legacyProofs.length > 0 && (
          <button
            onClick={pindahkanFotoLama}
            disabled={busyStorage}
            className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 border border-emerald-100 text-xs font-bold cursor-pointer"
          >
            <CloudUpload className="w-3.5 h-3.5 inline mr-1" />
            {busyStorage ? 'Memindahkan...' : `Pindahkan ${legacyProofs.length} foto lama ke cloud (${formatBytes(legacyProofs.reduce((sum, item) => sum + item.bytes, 0))})`}
          </button>
        )}
        <button onClick={buangCacheAman} className="px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 text-xs font-bold cursor-pointer">
          <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Buang cache audit & recycle
        </button>
      </div>
    </div>
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between no-print">
      {tab === 'recycle' && recycle.length > 0 && <button onClick={emptyAll} title="Bebas-kan storage bila localStorage penuh" className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer hover:bg-rose-100"><Trash2 className="w-3.5 h-3.5 inline mr-1" /> Kosongkan ({recycle.length})</button>}
      <div className="inline-flex bg-gray-100 p-1 rounded-xl"><button onClick={() => setTab('audit')} className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${tab === 'audit' ? 'bg-[var(--color-evergreen)] text-white' : 'text-gray-600'}`}><History className="w-3.5 h-3.5 inline mr-1" /> Audit Log</button><button onClick={() => setTab('recycle')} className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${tab === 'recycle' ? 'bg-[var(--color-evergreen)] text-white' : 'text-gray-600'}`}><Trash2 className="w-3.5 h-3.5 inline mr-1" /> Recycle Bin ({recycle.length})</button></div>
      <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari aktivitas atau data..." className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs w-full sm:w-72 focus:outline-none focus:border-emerald-600" /></div>
    </div>
    {tab === 'audit' ? <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto"><table className="w-full text-xs"><thead className="bg-evergreen text-white font-bold uppercase tracking-wider text-[10px]"><tr><th className="p-3 text-left">Waktu</th><th className="p-3 text-left">Pelaku</th><th className="p-3 text-left">Tindakan</th><th className="p-3 text-left">Keterangan</th></tr></thead><tbody>{filteredLogs.map(log => <tr key={log.id} className="border-t border-emerald-200"><td className="p-3 whitespace-nowrap text-gray-500">{formatTime(log.timestamp)}</td><td className="p-3"><b>{log.actor_name}</b><span className="block text-[10px] text-gray-400">{log.actor_role}</span></td><td className="p-3"><span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-bold uppercase text-[9px]">{log.action}</span><span className="block mt-1 text-gray-400">{log.entity_type}</span></td><td className="p-3 text-gray-700 min-w-64">{log.description}</td></tr>)}{!filteredLogs.length && <tr><td colSpan={4} className="p-10 text-center text-gray-400">Belum ada aktivitas tercatat.</td></tr>}</tbody></table></div>
    : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{filteredRecycle.map(item => <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3"><div><span className="text-[9px] uppercase font-bold bg-rose-50 text-rose-600 px-2 py-1 rounded">{item.entity_type}</span><h3 className="font-bold text-gray-900 mt-2 truncate">{item.label}</h3><p className="text-[11px] text-gray-500">Dihapus {formatTime(item.deleted_at)} oleh {item.deleted_by_name}</p><p className="text-[10px] text-amber-700 mt-1">Kedaluwarsa {formatTime(item.expires_at)}</p></div><div className="grid grid-cols-2 gap-2"><button onClick={() => restore(item)} className="py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold cursor-pointer"><RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Pulihkan</button><button onClick={() => removeForever(item)} className="py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 text-xs font-bold cursor-pointer"><Trash2 className="w-3.5 h-3.5 inline mr-1" /> Permanen</button></div></div>)}{!filteredRecycle.length && <div className="col-span-full p-10 bg-white border border-gray-200 rounded-xl text-center text-sm text-gray-400">Recycle Bin kosong.</div>}</div>}
  </div>;
};
