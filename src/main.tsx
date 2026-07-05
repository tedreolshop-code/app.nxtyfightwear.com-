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
