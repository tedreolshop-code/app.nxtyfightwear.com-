import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck, PackageCheck, Send, XCircle } from 'lucide-react';
import { dataStore, wibNowISO } from '../dataStore';
import { Employee, ProductionHandoff, ProductionJob } from '../types';

interface Props {
  jobs: ProductionJob[];
  currentEmployee?: Employee | null;
  isAdmin: boolean;
}

export const ProductionHandoffPanel: React.FC<Props> = ({ jobs, currentEmployee, isAdmin }) => {
  const [handoffs, setHandoffs] = useState<ProductionHandoff[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobId, setJobId] = useState('');
  const [stageName, setStageName] = useState('');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [qtySent, setQtySent] = useState(0);
  const [qtyRejected, setQtyRejected] = useState(0);
  const [notes, setNotes] = useState('');

  const load = () => {
    setHandoffs(dataStore.getProductionHandoffs());
    setEmployees(dataStore.getEmployees().filter(employee => employee.status_aktif));
  };

  useEffect(() => {
    load();
    window.addEventListener('nxty_storage_change', load);
    return () => window.removeEventListener('nxty_storage_change', load);
  }, []);

  const selectedJob = jobs.find(job => job.id === jobId);
  const stageIndex = selectedJob?.stages.findIndex(stage => stage.stage === stageName) ?? -1;
  const nextStage = selectedJob && stageIndex >= 0 ? selectedJob.stages[stageIndex + 1]?.stage || 'Gudang Barang Jadi' : '';
  const incomingQty = useMemo(() => {
    if (!selectedJob || stageIndex < 0) return 0;
    if (stageIndex === 0) return selectedJob.qty;
    return handoffs.filter(item => item.job_id === selectedJob.id && item.to_stage === stageName && item.status === 'accepted').reduce((sum, item) => sum + (item.qty_received ?? item.qty_sent), 0);
  }, [handoffs, selectedJob, stageIndex, stageName]);
  const alreadyProcessed = useMemo(() => handoffs.filter(item => item.job_id === jobId && item.from_stage === stageName && item.status !== 'disputed').reduce((sum, item) => sum + item.qty_sent + item.qty_rejected, 0), [handoffs, jobId, stageName]);
  const availableQty = Math.max(0, incomingQty - alreadyProcessed);

  const activeStages = selectedJob?.stages.filter((stage, index) => stage.status === 'ongoing' || (index === 0 && stage.status === 'pending')) || [];
  const targetEmployees = employees.filter(employee => employee.department_id === selectedJob?.department_id && employee.id !== currentEmployee?.id);
  const pendingIncoming = handoffs.filter(item => item.status === 'pending' && (isAdmin || item.to_employee_id === currentEmployee?.id));
  const recent = handoffs.filter(item => isAdmin || item.from_employee_id === currentEmployee?.id || item.to_employee_id === currentEmployee?.id).slice(0, 12);

  const createHandoff = (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentEmployee || !selectedJob || stageIndex < 0) return alert('Identitas pengirim atau pekerjaan tidak tersedia.');
    if (qtySent <= 0 || qtyRejected < 0 || qtySent + qtyRejected > availableQty) return alert(`Jumlah tidak valid. Maksimal yang tersedia ${availableQty} pcs.`);
    if (nextStage !== 'Gudang Barang Jadi' && !targetEmployeeId) return alert('Pilih karyawan penerima pada bagian berikutnya.');
    const target = employees.find(employee => employee.id === targetEmployeeId);
    const handoff: ProductionHandoff = {
      id: `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      job_id: selectedJob.id,
      order_number: selectedJob.order_number,
      product_name: selectedJob.product_name,
      from_stage: stageName,
      to_stage: nextStage,
      from_department_id: selectedJob.department_id,
      to_department_id: selectedJob.department_id,
      from_employee_id: currentEmployee.id,
      from_employee_name: currentEmployee.name,
      to_employee_id: target?.id,
      to_employee_name: target?.name || (nextStage === 'Gudang Barang Jadi' ? 'Gudang Barang Jadi' : undefined),
      qty_sent: qtySent,
      qty_rejected: qtyRejected,
      status: 'pending',
      notes: notes.trim(),
      created_at: wibNowISO()
    };
    dataStore.setProductionHandoffs([handoff, ...dataStore.getProductionHandoffs()]);
    dataStore.logAudit('create', 'production_handoff', `${currentEmployee.name} menyerahkan ${qtySent} pcs ${selectedJob.product_name} dari ${stageName} ke ${nextStage}`, handoff.id);
    setQtySent(0); setQtyRejected(0); setNotes(''); setTargetEmployeeId('');
    alert('Serah-terima dibuat. Hasil menunggu konfirmasi penerima.');
  };

  const acceptHandoff = (handoff: ProductionHandoff) => {
    if (!currentEmployee && !isAdmin) return;
    const receiver = currentEmployee || ({ id: 'admin', name: 'Admin' } as Employee);
    const updatedHandoff: ProductionHandoff = { ...handoff, status: 'accepted', qty_received: handoff.qty_sent, received_at: wibNowISO(), received_by_id: receiver.id, received_by_name: receiver.name };
    const updatedHandoffs = dataStore.getProductionHandoffs().map(item => item.id === handoff.id ? updatedHandoff : item);
    dataStore.setProductionHandoffs(updatedHandoffs);

    const allJobs = dataStore.getProductionJobs();
    const job = allJobs.find(item => item.id === handoff.job_id);
    if (job) {
      const fromIndex = job.stages.findIndex(stage => stage.stage === handoff.from_stage);
      const inputForStage = fromIndex === 0 ? job.qty : updatedHandoffs.filter(item => item.job_id === job.id && item.to_stage === handoff.from_stage && item.status === 'accepted').reduce((sum, item) => sum + (item.qty_received ?? item.qty_sent), 0);
      const processed = updatedHandoffs.filter(item => item.job_id === job.id && item.from_stage === handoff.from_stage && item.status === 'accepted').reduce((sum, item) => sum + (item.qty_received ?? item.qty_sent) + item.qty_rejected, 0);
      const nextIndex = fromIndex + 1;
      const stages = job.stages.map((stage, index) => {
        if (index === fromIndex) return { ...stage, status: (processed >= inputForStage ? 'completed' : 'ongoing') as 'completed' | 'ongoing', updated_at: wibNowISO(), updated_by: handoff.from_employee_name, notes: handoff.notes || stage.notes };
        if (index === nextIndex) return { ...stage, status: 'ongoing' as const, updated_at: wibNowISO(), updated_by: receiver.name };
        return stage;
      });
      const allCompleted = stages.every(stage => stage.status === 'completed');
      const updatedJob: ProductionJob = { ...job, stages, current_stage: stages.find(stage => stage.status === 'ongoing')?.stage || handoff.to_stage, status: allCompleted ? 'completed' : 'ongoing' };
      dataStore.setProductionJobs(allJobs.map(item => item.id === job.id ? updatedJob : item));

      if (handoff.to_stage === 'Gudang Barang Jadi') {
        const products = dataStore.getProducts().map(product => product.id === job.product_id ? { ...product, stock: product.stock + handoff.qty_sent } : product);
        dataStore.setProducts(products);
        const movements = dataStore.getStockMovements();
        movements.unshift({ id: `mov-${Math.random().toString(36).slice(2, 9)}`, type: 'barang_jadi_masuk', item_id: job.product_id, item_name: job.product_name, amount: handoff.qty_sent, reference: `Serah-terima final ${handoff.order_number || job.id}`, created_at: wibNowISO() });
        dataStore.setStockMovements(movements);
      }
    }
    dataStore.logAudit('update', 'production_handoff', `${receiver.name} menerima ${handoff.qty_sent} pcs dari ${handoff.from_employee_name}`, handoff.id);
    load();
  };

  const disputeHandoff = (handoff: ProductionHandoff) => {
    const reason = window.prompt('Jelaskan selisih atau alasan penolakan serah-terima:');
    if (!reason?.trim()) return;
    const receiver = currentEmployee?.name || 'Admin';
    dataStore.setProductionHandoffs(dataStore.getProductionHandoffs().map(item => item.id === handoff.id ? { ...item, status: 'disputed', dispute_note: reason.trim(), received_at: wibNowISO(), received_by_id: currentEmployee?.id, received_by_name: receiver } : item));
    dataStore.logAudit('update', 'production_handoff', `${receiver} mengajukan selisih serah-terima dari ${handoff.from_employee_name}`, handoff.id, { reason });
    load();
  };

  if (!currentEmployee && !isAdmin) return null;

  return <div className="space-y-4">
    {pendingIncoming.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4"><p className="font-black text-amber-900 text-sm">Ada {pendingIncoming.length} hasil kerja baru menunggu konfirmasi</p><p className="text-xs text-amber-700 mt-1">Periksa jumlah fisik sebelum menerima.</p></div>}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <form onSubmit={createHandoff} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div><h3 className="font-black text-sm text-gray-900 flex items-center gap-2"><Send className="w-4 h-4 text-[var(--color-evergreen)]" /> Serahkan Hasil Kerja</h3><p className="text-[11px] text-gray-500">Catat hasil sebelum berpindah ke bagian berikutnya.</p></div>
        <select value={jobId} onChange={event => { setJobId(event.target.value); setStageName(''); }} className="w-full border rounded-lg p-2 text-xs" required><option value="">Pilih pekerjaan produksi</option>{jobs.filter(job => job.status !== 'completed').map(job => <option key={job.id} value={job.id}>{job.order_number || 'Internal'} · {job.product_name} · {job.qty} pcs</option>)}</select>
        <select value={stageName} onChange={event => setStageName(event.target.value)} className="w-full border rounded-lg p-2 text-xs" required><option value="">Pilih bagian yang dikerjakan</option>{activeStages.map(stage => <option key={stage.stage} value={stage.stage}>{stage.stage}</option>)}</select>
        {stageName && <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-xs text-emerald-800">Tersedia di bagian ini: <b>{availableQty} pcs</b> <ArrowRight className="inline w-3 h-3" /> Tujuan: <b>{nextStage}</b></div>}
        {nextStage && nextStage !== 'Gudang Barang Jadi' && <select value={targetEmployeeId} onChange={event => setTargetEmployeeId(event.target.value)} className="w-full border rounded-lg p-2 text-xs" required><option value="">Pilih karyawan penerima berikutnya</option>{targetEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select>}
        <div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] font-bold text-gray-500">HASIL BAIK</label><input type="number" min="1" max={availableQty || undefined} value={qtySent || ''} onChange={event => setQtySent(Number(event.target.value))} className="w-full border rounded-lg p-2 text-xs" /></div><div><label className="text-[10px] font-bold text-gray-500">RUSAK/REWORK</label><input type="number" min="0" value={qtyRejected || ''} onChange={event => setQtyRejected(Number(event.target.value))} className="w-full border rounded-lg p-2 text-xs" /></div></div>
        <textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan hasil atau kendala (opsional)" rows={2} className="w-full border rounded-lg p-2 text-xs" />
        <button disabled={!jobId || !stageName || availableQty <= 0} className="w-full bg-[var(--color-evergreen)] disabled:bg-gray-300 text-white rounded-lg py-2.5 text-xs font-bold cursor-pointer disabled:cursor-not-allowed">Kirim Serah-Terima</button>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3"><div><h3 className="font-black text-sm flex items-center gap-2"><PackageCheck className="w-4 h-4 text-amber-600" /> Hasil Masuk</h3><p className="text-[11px] text-gray-500">Konfirmasi hanya setelah jumlah fisik diperiksa.</p></div>{pendingIncoming.length === 0 ? <p className="p-6 text-center text-xs text-gray-400 bg-gray-50 rounded-lg">Tidak ada serah-terima yang menunggu.</p> : pendingIncoming.map(item => <div key={item.id} className="border border-amber-200 bg-amber-50/40 rounded-lg p-3 text-xs"><div className="flex justify-between gap-2"><div><b>{item.product_name}</b><p className="text-gray-500">{item.from_stage} → {item.to_stage}</p><p className="mt-1">Dari {item.from_employee_name}: <b>{item.qty_sent} pcs</b>{item.qty_rejected > 0 ? ` · Reject ${item.qty_rejected}` : ''}</p></div><span className="text-[9px] text-gray-400">{new Date(item.created_at).toLocaleString('id-ID')}</span></div><div className="grid grid-cols-2 gap-2 mt-3"><button onClick={() => acceptHandoff(item)} className="bg-emerald-600 text-white rounded-lg py-2 font-bold cursor-pointer"><CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> Terima</button><button onClick={() => disputeHandoff(item)} className="bg-white text-rose-700 border border-rose-200 rounded-lg py-2 font-bold cursor-pointer"><XCircle className="w-3.5 h-3.5 inline mr-1" /> Ada Selisih</button></div></div>)}</div>
    </div>
    <div className="bg-white border border-gray-200 rounded-xl p-4"><h3 className="font-black text-xs uppercase text-gray-600 flex items-center gap-2 mb-3"><ClipboardCheck className="w-4 h-4" /> Riwayat Serah-Terima Terbaru</h3><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-[9px] uppercase text-gray-400"><tr><th className="text-left p-2">Waktu</th><th className="text-left p-2">Produk</th><th className="text-left p-2">Alur</th><th className="text-right p-2">Qty</th><th className="text-left p-2">Pengirim → Penerima</th><th className="text-center p-2">Status</th></tr></thead><tbody>{recent.map(item => <tr key={item.id} className="border-t"><td className="p-2 whitespace-nowrap">{new Date(item.created_at).toLocaleString('id-ID')}</td><td className="p-2 font-bold">{item.product_name}</td><td className="p-2">{item.from_stage} → {item.to_stage}</td><td className="p-2 text-right font-mono">{item.qty_sent}</td><td className="p-2">{item.from_employee_name} → {item.to_employee_name}</td><td className="p-2 text-center"><span className={`px-2 py-1 rounded text-[9px] font-bold ${item.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : item.status === 'disputed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{item.status}</span></td></tr>)}{recent.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-400">Belum ada serah-terima.</td></tr>}</tbody></table></div></div>
  </div>;
};
