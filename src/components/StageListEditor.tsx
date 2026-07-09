import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { STAGE_SUGGESTIONS } from '../dataStore';

interface Props {
  stages: string[];
  onChange: (stages: string[]) => void;
  compact?: boolean; // tampilan lebih rapat untuk di dalam modal
}

/**
 * Editor urutan tahapan produksi: tambah, hapus, geser naik/turun.
 * Dipakai di form produk (gudang) dan preview alur saat kirim order ke produksi.
 */
export const StageListEditor: React.FC<Props> = ({ stages, onChange, compact }) => {
  const [newStage, setNewStage] = useState('');

  const addStage = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (stages.some(s => s.toLowerCase() === clean.toLowerCase())) {
      alert(`Tahap "${clean}" sudah ada di daftar.`);
      return;
    }
    onChange([...stages, clean]);
    setNewStage('');
  };

  const removeStage = (index: number) => onChange(stages.filter((_, i) => i !== index));

  const moveStage = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const lastIsPacking = stages.length > 0 && stages[stages.length - 1].toLowerCase() === 'packing';
  const unusedSuggestions = STAGE_SUGGESTIONS.filter(s => !stages.some(st => st.toLowerCase() === s.toLowerCase()));

  return (
    <div className="space-y-2">
      {/* Daftar tahap berurutan */}
      {stages.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic bg-gray-50 rounded-lg p-3 text-center">
          Belum ada tahapan — tambahkan minimal satu tahap.
        </p>
      ) : (
        <div className="space-y-1">
          {stages.map((stage, index) => (
            <div key={`${stage}-${index}`} className={`flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
              <span className="w-5 h-5 rounded-full bg-[var(--color-evergreen)] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                {index + 1}
              </span>
              <span className="flex-1 text-xs font-bold text-gray-800 truncate">{stage}</span>
              <button type="button" onClick={() => moveStage(index, -1)} disabled={index === 0}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20" title="Geser ke atas">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => moveStage(index, 1)} disabled={index === stages.length - 1}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20" title="Geser ke bawah">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => removeStage(index)}
                className="p-1 text-rose-400 hover:text-rose-600" title="Hapus tahap">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input tambah tahap */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newStage}
          onChange={(e) => setNewStage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStage(newStage); } }}
          placeholder="Ketik nama tahap baru..."
          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-evergreen"
        />
        <button type="button" onClick={() => addStage(newStage)}
          className="flex items-center gap-1 px-3 py-1.5 bg-[var(--color-evergreen)] text-white rounded-lg text-xs font-bold hover:bg-opacity-90">
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </div>

      {/* Tombol cepat tahap umum */}
      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unusedSuggestions.map(s => (
            <button key={s} type="button" onClick={() => addStage(s)}
              className="px-2 py-0.5 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-500 rounded text-[10px] font-semibold border border-gray-200">
              + {s}
            </button>
          ))}
        </div>
      )}

      {/* Peringatan lembut bila alur tidak diakhiri Packing */}
      {stages.length > 0 && !lastIsPacking && (
        <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>Tahap terakhir bukan "Packing". Tahap terakhir adalah pintu masuk stok ke gudang barang jadi — pastikan ini memang disengaja.</span>
        </div>
      )}
    </div>
  );
};
