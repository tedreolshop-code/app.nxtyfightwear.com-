/**
 * Helper white label: baca pengaturan brand dan terapkan warna tema ke CSS
 * variables sehingga seluruh aplikasi (kelas evergreen/*) ikut berubah.
 */
import { useEffect, useState } from 'react';
import { BrandSettings } from './types';
import { dataStore } from './dataStore';

// Geser terang/gelap sebuah warna hex. amount -1..1 (negatif = lebih gelap).
const shiftColor = (hex: string, amount: number): string => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const channels = [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16));
  const shifted = channels.map(c => {
    const next = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.round(Math.min(255, Math.max(0, next)));
  });
  return '#' + shifted.map(c => c.toString(16).padStart(2, '0')).join('');
};

export const applyBrandTheme = (brand: BrandSettings): void => {
  const root = document.documentElement;
  root.style.setProperty('--color-evergreen', brand.primary_color);
  root.style.setProperty('--color-evergreen-dark', shiftColor(brand.primary_color, -0.3));
  root.style.setProperty('--color-evergreen-tint', shiftColor(brand.primary_color, 0.88));
  // Judul tab browser ikut nama brand
  document.title = `${brand.company_name} — ${brand.tagline || 'Sistem Produksi'}`;
};

// Inisial brand untuk chip kecil (mis. "ARI" dari "ARI SPORTINDO")
export const brandInitials = (name: string): string =>
  (name.trim().split(/\s+/)[0] || 'APP').slice(0, 4).toUpperCase();

// Shortcut untuk teks yang dibaca saat render/cetak/ekspor (non-reaktif cukup)
export const brandName = (): string => dataStore.getBrandSettings().company_name;
export const brandLegalName = (): string => dataStore.getBrandSettings().legal_name || dataStore.getBrandSettings().company_name;

/** Hook: pengaturan brand yang selalu mengikuti perubahan (termasuk sinkron cloud). */
export const useBrand = (): BrandSettings => {
  const [brand, setBrand] = useState<BrandSettings>(() => dataStore.getBrandSettings());
  useEffect(() => {
    const refresh = () => setBrand(dataStore.getBrandSettings());
    window.addEventListener('nxty_storage_change', refresh);
    return () => window.removeEventListener('nxty_storage_change', refresh);
  }, []);
  useEffect(() => { applyBrandTheme(brand); }, [brand]);
  return brand;
};
