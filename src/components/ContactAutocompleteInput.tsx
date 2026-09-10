import React, { useMemo, useRef, useState, useEffect } from 'react';
import { User } from 'lucide-react';

/**
 * Input teks dengan saran otomatis dari daftar nama + kontak.
 * - Ketik sebagian nama → saran muncul, pilih → nama & kontak terisi sekaligus.
 * - Daftar disusun: yang paling sering muncul di `histori` di atas, lalu A-Z.
 * - Tetap bisa mengetik nama baru yang belum ada di daftar (input bebas).
 */
export const ContactAutocompleteInput: React.FC<{
  value: string;
  onChange: (nama: string) => void;
  onPickContact?: (kontak: string) => void;
  histori?: string[]; // nama-nama dari riwayat transaksi (menentukan urutan saran)
  daftar: Array<{ name: string; contact?: string }>;
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  required?: boolean;
  ariaLabel?: string;
}> = ({ value, onChange, onPickContact, histori = [], daftar, placeholder, icon: Icon = User, required, ariaLabel }) => {
  const [fokus, setFokus] = useState(false);
  const [sorot, setSorot] = useState(-1);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saran = useMemo(() => {
    const q = value.trim().toLowerCase();
    // Frekuensi nama di histori: yang sering transaksi di atas
    const freq = new Map<string, number>();
    histori.forEach(n => { const k = n.trim(); if (k) freq.set(k, (freq.get(k) || 0) + 1); });
    const gabungan = new Map<string, string>();
    daftar.forEach(d => { const k = d.name.trim(); if (k && !gabungan.has(k.toLowerCase())) gabungan.set(k.toLowerCase(), d.contact || ''); });
    const semua = [...gabungan.keys()].map(k => {
      const namaAsli = daftar.find(d => d.name.trim().toLowerCase() === k)?.name.trim() || k;
      return { nama: namaAsli, kontak: gabungan.get(k) || '', freq: freq.get(namaAsli) || 0 };
    });
    const cocok = q ? semua.filter(s => s.nama.toLowerCase().includes(q)) : semua;
    return cocok
      .sort((a, b) => b.freq - a.freq || a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' }))
      .slice(0, 6);
  }, [value, histori, daftar]);

  useEffect(() => () => { if (blurTimeout.current) clearTimeout(blurTimeout.current); }, []);

  const pilih = (nama: string, kontak: string) => {
    onChange(nama);
    if (kontak && onPickContact) onPickContact(kontak);
    setFokus(false);
    setSorot(-1);
  };

  return (
    <div className="relative">
      <Icon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setSorot(-1); }}
        onFocus={() => { if (blurTimeout.current) clearTimeout(blurTimeout.current); setFokus(true); }}
        onBlur={() => { blurTimeout.current = setTimeout(() => setFokus(false), 150); }}
        onKeyDown={(e) => {
          if (!fokus || saran.length === 0) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setSorot(s => Math.min(s + 1, saran.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSorot(s => Math.max(s - 1, -1)); }
          else if (e.key === 'Enter' && sorot >= 0) { e.preventDefault(); pilih(saran[sorot].nama, saran[sorot].kontak); }
          else if (e.key === 'Escape') setFokus(false);
        }}
        className="pl-9 w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs"
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        aria-label={ariaLabel}
      />{fokus && saran.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {saran.map((s, i) => (
            <button
              key={s.nama}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pilih(s.nama, s.kontak); }}
              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 cursor-pointer ${
                i === sorot ? 'bg-emerald-50' : 'hover:bg-gray-50'
              }`}
            >
              <span className="font-semibold text-gray-800 truncate">{s.nama}</span>
              {s.kontak && <span className="font-mono text-gray-400 shrink-0">{s.kontak}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
