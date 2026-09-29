/// <reference types="vite/client" />

// Cap build yang disuntikkan vite.config.ts. Dipakai sebagai versi cache service
// worker supaya setiap deploy memakai cache baru dan berkas lama ikut terbuang.
declare const __BUILD_ID__: string;
