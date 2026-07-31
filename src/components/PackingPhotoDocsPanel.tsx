import React, { useEffect, useState } from 'react';
import { PackingTask } from '../types';
import { dataStore } from '../dataStore';
import { uploadPackingPhoto, deletePackingPhoto, canDeletePhoto } from '../packingPhoto';
import { Camera, Trash2 } from 'lucide-react';

interface PackingPhotoDocsPanelProps {
  userRole: string;
  currentEmployee?: { name: string } | null;
}

export const PackingPhotoDocsPanel: React.FC<PackingPhotoDocsPanelProps> = ({ userRole, currentEmployee }) => {
  const [packingTasks, setPackingTasks] = useState<PackingTask[]>([]);
  const [uploadingPhotoTaskId, setUploadingPhotoTaskId] = useState('');

  const loadData = () => setPackingTasks(dataStore.getPackingTasks());

  useEffect(() => {
    loadData();
    window.addEventListener('nxty_storage_change', loadData);
    return () => window.removeEventListener('nxty_storage_change', loadData);
  }, []);

  const packingTasksTanpaFoto = packingTasks
    .filter(task => task.status === 'completed' && !task.photo_url)
    .sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || '')));

  const handleAttachPackingPhoto = async (task: PackingTask, file?: File | null) => {
    if (!file) return;
    setUploadingPhotoTaskId(task.id);
    try {
      const url = await uploadPackingPhoto(task.order_number || task.id, file);
      if (!url) {
        alert('Penyimpanan foto tidak aktif. Isi VITE_SUPABASE_* di .env lalu muat ulang halaman.');
        return;
      }
      dataStore.setPackingTaskPhoto(task.id, { url, uploaded_by: currentEmployee?.name || dataStore.getCurrentActor().name });
      loadData();
    } catch (error) {
      alert(`Upload foto gagal: ${error instanceof Error ? error.message : 'periksa koneksi internet'}. Coba lagi dari daftar ini.`);
    } finally {
      setUploadingPhotoTaskId('');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-xs animate-fadeIn">
      <div className="flex justify-between items-center border-b border-gray-100 pb-3">
        <div>
          <h3 className="font-bold text-sm text-gray-800 font-sans">Dokumentasi Foto Packing</h3>
          <p className="text-xs text-gray-400">Foto barang saat selesai packing, sebagai bukti sebelum dikirim</p>
        </div>
        <Camera className="w-4.5 h-4.5 text-gray-400" />
      </div>

      {/* Packing selesai yang fotonya belum ada — dulu tidak terlihat sama sekali,
          padahal upload bisa gagal atau terlewat saat karyawan menyelesaikan packing */}
      {packingTasksTanpaFoto.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
          <p className="text-xs font-bold text-amber-800">
            {packingTasksTanpaFoto.length} packing selesai belum ada fotonya
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {packingTasksTanpaFoto.map(task => (
              <label key={task.id} className="bg-white border border-amber-200 rounded-lg p-2.5 text-xs cursor-pointer hover:bg-amber-50/60 block">
                <p className="font-bold text-gray-800">{task.order_number}</p>
                <p className="text-[10px] text-gray-400">{task.customer_name} · packing oleh {task.employee_name}</p>
                <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-800">
                  <Camera className="w-3 h-3" /> {uploadingPhotoTaskId === task.id ? 'Mengunggah…' : 'Ambil / Pilih Foto'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={uploadingPhotoTaskId === task.id}
                  onChange={event => handleAttachPackingPhoto(task, event.target.files?.[0])}
                  className="hidden"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {packingTasks.filter(task => task.status === 'completed' && task.photo_url).length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-6 col-span-full">Belum ada foto dokumentasi packing.</p>
        ) : packingTasks.filter(task => task.status === 'completed' && task.photo_url).map(task => (
          <div key={task.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
            <a href={task.photo_url} target="_blank" rel="noreferrer">
              <img src={task.photo_url} alt={`Dokumentasi packing ${task.order_number}`} className="w-full h-36 object-cover rounded border border-gray-200" />
            </a>
            <div className="flex justify-between items-start gap-2">
              <div className="space-y-0.5 text-xs">
                <p className="font-bold text-gray-800">{task.order_number} · {task.customer_name}</p>
                <p className="text-[10px] text-gray-400">Oleh {task.photo_uploaded_by || task.employee_name} · {task.photo_uploaded_at ? new Date(task.photo_uploaded_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
              </div>
              {userRole === 'owner' && canDeletePhoto(task.photo_uploaded_at) && (
                <button
                  onClick={async () => {
                    if (!confirm(`Hapus foto dokumentasi packing ${task.order_number}?`)) return;
                    if (task.photo_url) { try { await deletePackingPhoto(task.photo_url); } catch { /* file mungkin sudah terhapus, lanjut bersihkan record */ } }
                    dataStore.deletePackingTaskPhoto(task.id);
                    loadData();
                  }}
                  title="Hapus foto (hanya bisa dalam 14 hari sejak diunggah)"
                  className="bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded px-2 py-1 text-[10px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
