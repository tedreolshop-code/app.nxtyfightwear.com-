import React from 'react';
import { DIVISIONS } from '../types';

/**
 * Warna tiap tombol divisi, sewarna dengan badge divisi di tabel: Eva Foam hijau,
 * Konveksi biru. Tidak aktif pun tetap berwarna (versi muda) supaya divisinya
 * langsung terbaca tanpa harus diklik dulu.
 */
const DIVISION_BUTTON_STYLE: Record<string, { active: string; idle: string }> = {
  '': {
    active: 'bg-white text-evergreen shadow-xs',
    idle: 'text-gray-500 hover:text-gray-700',
  },
  'dept-eva-foam': {
    active: 'bg-emerald-600 text-white shadow-xs',
    idle: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100',
  },
  'dept-konveksi': {
    active: 'bg-sky-600 text-white shadow-xs',
    idle: 'text-sky-700 bg-sky-50 hover:bg-sky-100',
  },
  shared: {
    active: 'bg-gray-600 text-white shadow-xs',
    idle: 'text-gray-600 bg-white hover:bg-gray-50',
  },
};

/**
 * Filter divisi dengan bentuk yang sama di seluruh aplikasi.
 * '' = semua divisi. Nilai lainnya adalah department_id.
 */
export const DivisionFilter: React.FC<{
  value: string;
  onChange: (departmentId: string) => void;
  /** Label untuk transaksi tanpa divisi. Kosongkan bila tidak ada pilihan itu. */
  sharedLabel?: string;
  sharedValue?: string;
}> = ({ value, onChange, sharedLabel, sharedValue = 'shared' }) => {
  const options: Array<[string, string]> = [
    ['', 'Semua Divisi'],
    ...DIVISIONS.map(d => [d.id, d.label] as [string, string]),
    ...(sharedLabel ? [[sharedValue, sharedLabel] as [string, string]] : []),
  ];
  return (
    <div className="flex flex-wrap bg-gray-100 p-1 rounded-lg border border-gray-200 text-[10px] font-black w-fit max-w-full shrink-0">
      {options.map(([optionValue, label]) => {
        const active = value === optionValue;
        const style = DIVISION_BUTTON_STYLE[optionValue] ?? DIVISION_BUTTON_STYLE.shared;
        return (
          <button
            key={optionValue || 'all'}
            type="button"
            onClick={() => onChange(optionValue)}
            className={`px-2.5 py-1 rounded-md uppercase transition-all cursor-pointer whitespace-nowrap ${
              active ? style.active : style.idle
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Cocokkan satu baris data dengan filter divisi.
 * `shared` menentukan perlakuan data tanpa divisi: 'match-all' untuk bahan Umum yang
 * memang dipakai kedua divisi, 'own-bucket' untuk biaya bersama yang punya tombol sendiri.
 */
export const matchesDivision = (
  departmentId: string | undefined,
  filter: string,
  shared: 'match-all' | 'own-bucket' = 'own-bucket',
  sharedValue = 'shared',
): boolean => {
  if (!filter) return true;
  if (filter === sharedValue) return !departmentId;
  if (departmentId === filter) return true;
  return shared === 'match-all' && !departmentId;
};

export default DivisionFilter;
