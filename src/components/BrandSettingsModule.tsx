import React, { useRef, useState } from 'react';
import { BrandSettings } from '../types';
import { dataStore } from '../dataStore';
import { applyBrandTheme, brandInitials, useBrand } from '../brand';
import { Palette, Image as ImageIcon, Save, RotateCcw, Trash2, Building2, Info, GitBranch } from 'lucide-react';

const DEFAULT_COLOR = '#1F4B36';

// Kecilkan logo ke maks 256px & simpan sebagai data URL (PNG) agar ringan
// disimpan di localStorage/Supabase dan tetap tajam di header.
const fileToLogoDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid'));
      img.onload = () => {
        const maxSide = 256;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas tidak didukung browser')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

const HANDOFF_MODES: Array<{ id: 'assign' | 'queue' | 'hybrid'; label: string; desc: string }> = [
  { id: 'hybrid', label: 'Bebas (Disarankan)', desc: 'Karyawan memilih sendiri saat serah terima: tunjuk orang tertentu ATAU lepas ke antrean.' },
  { id: 'assign', label: 'Tunjuk Langsung', desc: 'Karyawan wajib memilih nama penerima. Cocok untuk tim kecil dengan tugas tetap.' },
  { id: 'queue', label: 'Antrean / Ambil Sendiri', desc: 'Hasil kerja selalu masuk antrean — karyawan bagian berikutnya mengambil sendiri lewat "Tersedia untuk Diambil".' },
];

export const BrandSettingsModule: React.FC = () => {
  const saved = useBrand();
  const [draft, setDraft] = useState<BrandSettings>(saved);
  const [handoffMode, setHandoffMode] = useState<'assign' | 'queue' | 'hybrid'>(
    () => dataStore.getWorkSettings().production_handoff_mode || 'hybrid'
  );

  const saveHandoffMode = (mode: 'assign' | 'queue' | 'hybrid') => {
    setHandoffMode(mode);
    dataStore.setWorkSettings({ ...dataStore.getWorkSettings(), production_handoff_mode: mode });
    dataStore.logAudit('update', 'work_settings', `Mengubah mode serah terima produksi menjadi "${HANDOFF_MODES.find(m => m.id === mode)?.label}"`);
  };
  const [savedFlash, setSavedFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<BrandSettings>) => setDraft(prev => ({ ...prev, ...patch }));

  const handleLogoFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('File harus berupa gambar (PNG/JPG/WebP).'); return; }
    try {
      update({ logo_data_url: await fileToLogoDataUrl(file) });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal memproses gambar logo.');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const clean: BrandSettings = {
      ...draft,
      company_name: draft.company_name.trim() || saved.company_name,
      legal_name: draft.legal_name.trim(),
      tagline: draft.tagline.trim(),
      primary_color: /^#[0-9a-fA-F]{6}$/.test(draft.primary_color) ? draft.primary_color : DEFAULT_COLOR,
    };
    dataStore.setBrandSettings(clean);
    dataStore.logAudit('update', 'brand_settings', `Mengubah pengaturan brand menjadi "${clean.company_name}"`);
    applyBrandTheme(clean);
    setDraft(clean);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  };

  const handleResetColor = () => update({ primary_color: DEFAULT_COLOR });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
        <span className="p-1.5 bg-emerald-50 text-evergreen rounded-lg">
          <Palette className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Pengaturan Brand & Tampilan</h1>
          <p className="text-xs text-gray-500">
            Nama perusahaan, logo, dan warna tema aplikasi — berlaku untuk semua perangkat setelah disimpan
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* KIRI: form */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-xs text-gray-700 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-evergreen" /> Identitas Perusahaan
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nama Brand / Perusahaan</label>
              <input
                type="text"
                value={draft.company_name}
                onChange={(e) => update({ company_name: e.target.value })}
                placeholder="Contoh: ARI SPORTINDO"
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-evergreen"
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">Tampil di halaman login, sidebar, laporan, PO, dan QR absensi.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nama Badan Hukum (untuk Slip Gaji)</label>
              <input
                type="text"
                value={draft.legal_name}
                onChange={(e) => update({ legal_name: e.target.value })}
                placeholder="Contoh: PT ARI SPORTINDO"
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-evergreen"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tagline / Subjudul</label>
              <input
                type="text"
                value={draft.tagline}
                onChange={(e) => update({ tagline: e.target.value })}
                placeholder="Contoh: Sistem Produksi & Manajemen"
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-evergreen"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-xs text-gray-700 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-evergreen" /> Logo Perusahaan
            </h3>

            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                {draft.logo_data_url ? (
                  <img src={draft.logo_data_url} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-[10px] text-gray-400 text-center px-2">Belum ada logo</span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { void handleLogoFile(e.target.files?.[0]); e.target.value = ''; }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-evergreen text-white rounded-lg text-xs font-bold hover:bg-opacity-90"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Pilih Gambar Logo
                </button>
                {draft.logo_data_url && (
                  <button
                    type="button"
                    onClick={() => update({ logo_data_url: '' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold hover:bg-red-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus Logo
                  </button>
                )}
                <p className="text-[10px] text-gray-400">PNG/JPG, disarankan bentuk persegi. Otomatis dikecilkan ke 256px.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-xs text-gray-700 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-evergreen" /> Warna Tema Utama
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={draft.primary_color}
                onChange={(e) => update({ primary_color: e.target.value })}
                className="w-12 h-10 rounded cursor-pointer border border-gray-200 bg-white p-0.5"
              />
              <input
                type="text"
                value={draft.primary_color}
                onChange={(e) => update({ primary_color: e.target.value })}
                className="w-28 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-mono font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-evergreen"
                pattern="^#[0-9a-fA-F]{6}$"
                title="Format hex, contoh: #1F4B36"
              />
              <button
                type="button"
                onClick={handleResetColor}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded text-[11px] font-bold hover:bg-gray-200"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              Warna gelap (sidebar) dan warna muda (latar sorotan) dihitung otomatis dari warna utama ini.
            </p>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-1.5 bg-evergreen text-white font-bold py-2.5 rounded-lg shadow-sm text-sm hover:bg-opacity-90"
          >
            <Save className="w-4 h-4" />
            {savedFlash ? 'Tersimpan ✓' : 'Simpan Pengaturan Brand'}
          </button>
        </div>

        {/* KANAN: preview langsung */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-gray-700">Pratinjau</h3>

            {/* Mock sidebar */}
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <div className="p-4 flex items-center gap-3" style={{ backgroundColor: draft.primary_color }}>
                {draft.logo_data_url ? (
                  <img src={draft.logo_data_url} alt="Logo" className="w-9 h-9 rounded bg-white/90 object-contain p-0.5 shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded bg-white/15 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                    {brandInitials(draft.company_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm truncate">{draft.company_name || 'Nama Brand'}</p>
                  <p className="text-white/60 text-[10px] truncate">{draft.tagline || 'Tagline'}</p>
                </div>
              </div>
              <div className="p-3 bg-gray-50 space-y-1.5">
                <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: draft.primary_color, opacity: 0.25 }} />
                <div className="h-2 rounded-full w-1/2" style={{ backgroundColor: draft.primary_color, opacity: 0.15 }} />
              </div>
            </div>

            {/* Mock tombol & badge */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: draft.primary_color }}>
                Tombol Utama
              </span>
              <span
                className="px-2 py-1 rounded text-[10px] font-bold"
                style={{ backgroundColor: `${draft.primary_color}1A`, color: draft.primary_color }}
              >
                Badge / Sorotan
              </span>
            </div>

            <p className="text-[10px] text-gray-400">
              Slip gaji akan mencantumkan: <b>{draft.legal_name || '(nama badan hukum belum diisi)'}</b>
            </p>
          </div>

          {/* Mode serah terima produksi — tersimpan langsung saat dipilih */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-3">
            <div>
              <h3 className="font-bold text-xs text-gray-700 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-evergreen" /> Mode Serah Terima Produksi
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Cara hasil kerja berpindah antar karyawan. Tersimpan otomatis saat dipilih.</p>
            </div>
            <div className="space-y-2">
              {HANDOFF_MODES.map(mode => (
                <label key={mode.id} className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  handoffMode === mode.id ? 'border-evergreen bg-emerald-50/60' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="handoff-mode"
                    checked={handoffMode === mode.id}
                    onChange={() => saveHandoffMode(mode.id)}
                    className="mt-0.5 text-evergreen focus:ring-evergreen"
                  />
                  <span>
                    <span className="block text-xs font-bold text-gray-800">{mode.label}</span>
                    <span className="block text-[10px] text-gray-500 leading-relaxed">{mode.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
            <Info className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed text-[11px]">
              Pengaturan ini tersimpan ke cloud dan otomatis berlaku di semua perangkat yang login.
              Perubahan tercatat di menu <b>Audit</b>.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
};
