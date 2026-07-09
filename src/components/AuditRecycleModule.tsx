import React, { useEffect, useMemo, useState } from 'react';
import { History, RotateCcw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { dataStore } from '../dataStore';
import { AuditEntry, RecycleEntry } from '../types';

export const AuditRecycleModule: React.FC = () => {
  const [tab, setTab] = useState<'audit' | 'recycle'>('audit');
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [recycle, setRecycle] = useState<RecycleEntry[]>([]);
  const [query, setQuery] = useState('');
  const load = () => { setLogs(dataStore.getAuditLogs()); setRecycle(dataStore.getRecycleBin()); };
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

  return <div className="space-y-5">
    <div><h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[var(--color-evergreen)]" /> Audit & Recycle Bin</h2><p className="text-xs text-gray-500 mt-1">Riwayat kegiatan penting dan data terhapus yang dapat dipulihkan selama 30 hari.</p></div>
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between no-print">
      <div className="inline-flex bg-gray-100 p-1 rounded-xl"><button onClick={() => setTab('audit')} className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${tab === 'audit' ? 'bg-[var(--color-evergreen)] text-white' : 'text-gray-600'}`}><History className="w-3.5 h-3.5 inline mr-1" /> Audit Log</button><button onClick={() => setTab('recycle')} className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${tab === 'recycle' ? 'bg-[var(--color-evergreen)] text-white' : 'text-gray-600'}`}><Trash2 className="w-3.5 h-3.5 inline mr-1" /> Recycle Bin ({recycle.length})</button></div>
      <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari aktivitas atau data..." className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs w-full sm:w-72 focus:outline-none focus:border-emerald-600" /></div>
    </div>
    {tab === 'audit' ? <div className="bg-white border border-gray-100 rounded-xl overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50 text-gray-500 uppercase text-[10px]"><tr><th className="p-3 text-left">Waktu</th><th className="p-3 text-left">Pelaku</th><th className="p-3 text-left">Tindakan</th><th className="p-3 text-left">Keterangan</th></tr></thead><tbody>{filteredLogs.map(log => <tr key={log.id} className="border-t border-gray-100"><td className="p-3 whitespace-nowrap text-gray-500">{formatTime(log.timestamp)}</td><td className="p-3"><b>{log.actor_name}</b><span className="block text-[10px] text-gray-400">{log.actor_role}</span></td><td className="p-3"><span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-bold uppercase text-[9px]">{log.action}</span><span className="block mt-1 text-gray-400">{log.entity_type}</span></td><td className="p-3 text-gray-700 min-w-64">{log.description}</td></tr>)}{!filteredLogs.length && <tr><td colSpan={4} className="p-10 text-center text-gray-400">Belum ada aktivitas tercatat.</td></tr>}</tbody></table></div>
    : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{filteredRecycle.map(item => <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 space-y-3"><div><span className="text-[9px] uppercase font-bold bg-rose-50 text-rose-600 px-2 py-1 rounded">{item.entity_type}</span><h3 className="font-bold text-gray-900 mt-2 truncate">{item.label}</h3><p className="text-[11px] text-gray-500">Dihapus {formatTime(item.deleted_at)} oleh {item.deleted_by_name}</p><p className="text-[10px] text-amber-700 mt-1">Kedaluwarsa {formatTime(item.expires_at)}</p></div><div className="grid grid-cols-2 gap-2"><button onClick={() => restore(item)} className="py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold cursor-pointer"><RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Pulihkan</button><button onClick={() => removeForever(item)} className="py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 text-xs font-bold cursor-pointer"><Trash2 className="w-3.5 h-3.5 inline mr-1" /> Permanen</button></div></div>)}{!filteredRecycle.length && <div className="col-span-full p-10 bg-white border border-gray-100 rounded-xl text-center text-sm text-gray-400">Recycle Bin kosong.</div>}</div>}
  </div>;
};
