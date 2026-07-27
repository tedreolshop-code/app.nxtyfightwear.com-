import React from 'react';
import { DIVISIONS } from '../types';

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
    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 text-[10px] font-black w-fit shrink-0">
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue || 'all'}
          type="button"
          onClick={() => onChange(optionValue)}
          className={`px-2.5 py-1 rounded-md uppercase transition-all cursor-pointer whitespace-nowrap ${
            value === optionValue ? 'bg-white text-evergreen shadow-xs' : 'text-gray-500'
          }`}
        >
          {label}
        </button>
      ))}
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
