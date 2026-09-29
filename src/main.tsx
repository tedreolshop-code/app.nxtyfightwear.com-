import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {initCloudSync} from './cloudSync';
import './index.css';

// Tarik data dari Supabase (bila dikonfigurasi) lalu dengarkan perubahan realtime.
// Tidak menunggu selesai: UI langsung render dari localStorage, data cloud menyusul.
initCloudSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker hanya aktif pada build produksi agar cache tidak mengganggu HMR.
// Cap build dikirim lewat query: sw.js memakainya sebagai nama cache, sehingga
// update selalu terpasang (cache lama dibuang) walau perangkat jarang dimuat ulang.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${__BUILD_ID__}`, { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch((error) => {
        console.error('Service worker gagal didaftarkan:', error);
      });
  });
}
