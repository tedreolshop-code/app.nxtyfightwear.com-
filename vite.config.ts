import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Cap build: dipakai main.tsx untuk mendaftarkan /sw.js?v=<cap> sehingga setiap
    // deploy produksi punya nama cache service worker sendiri (cache lama dibuang
    // saat activate) dan perangkat yang dipakai harian tidak menyajikan berkas lama.
    define: {
      __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
