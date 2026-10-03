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
  // Judul tab browser ikut nama brand (nama file PDF cetakan juga dari sini)
  document.title = brand.company_name;
  applyBrandIcons(brand);
};

// ===================== Ikon website mengikuti logo brand =====================
// Favicon tab browser & ikon PWA mengikuti logo yang diupload Owner lewat
// Pengaturan Brand; tanpa logo, kembali ke ikon bawaan aplikasi.
const DEFAULT_ICON = '/icons/app-icon.svg';

let brandManifestUrl: string | null = null;

const setLink = (rel: string, href: string, type?: string): void => {
  let link = document.querySelector<HTMLLinkElement>(`head link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  if (type) link.type = type;
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
};

const applyBrandIcons = (brand: BrandSettings): void => {
  const hasLogo = Boolean(brand.logo_data_url);
  const icon = hasLogo ? brand.logo_data_url : DEFAULT_ICON;

  setLink('icon', icon, hasLogo ? 'image/png' : 'image/svg+xml');
  setLink('apple-touch-icon', icon);

  // Manifest PWA dinamis: ikon (dan warna tema) mengikuti brand. Chrome/Edge
  // membaca ulang manifest saat aplikasi dibuka, jadi ikon ter-install ikut berubah.
  if (brandManifestUrl) {
    URL.revokeObjectURL(brandManifestUrl);
    brandManifestUrl = null;
  }
  if (hasLogo) {
    const manifest = {
      id: '/',
      name: brand.company_name,
      short_name: brand.company_name,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#F3F4F6',
      theme_color: brand.primary_color,
      icons: [
        { src: brand.logo_data_url, sizes: 'any', type: 'image/png', purpose: 'any' },
        { src: brand.logo_data_url, sizes: 'any', type: 'image/png', purpose: 'maskable' },
      ],
    };
    brandManifestUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
    setLink('manifest', brandManifestUrl);
  } else {
    setLink('manifest', '/manifest.webmanifest');
  }

  // Warna bar judul PWA/browser ikut warna tema brand
  document.querySelector<HTMLMetaElement>('head meta[name="theme-color"]')
    ?.setAttribute('content', brand.primary_color);
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
