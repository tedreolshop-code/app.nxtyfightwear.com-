// Versi cache diambil dari query pendaftaran (/sw.js?v=<cap build>, lihat main.tsx).
// Sebelumnya namanya tetap 'ari-sportindo-v1' sehingga cache TIDAK pernah diganti:
// aset setiap deploy menumpuk selamanya, dan perangkat yang dipakai harian bisa
// menyajikan berkas lama berhari-hari setelah rilis baru.
const BUILD_ID = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `ari-sportindo-${BUILD_ID}`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/app-icon.svg',
  '/icons/app-icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        // Semua cache dari build lain dibuang — termasuk 'ari-sportindo-*' versi lama
        // yang menahan aset tak terpakai.
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Aset ber-hash milik build ini boleh cache-first; permintaan lain (mis. file di
  // public/ yang namanya tetap) memakai network-first supaya perbaikan tidak
  // tertahan cache lama di perangkat yang dipakai harian.
  const hashedAsset = /\/assets\/[^/]+-[A-Za-z0-9_]{8,}\.[a-z0-9]+$/.test(url.pathname);
  if (hashedAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || new Response('', { status: 504, statusText: 'Offline' }))),
  );
});
