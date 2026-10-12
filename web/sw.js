/**
 * sw.js — service worker.
 *
 * STRATEGI (dipilih setelah bug "kode lama tetap jalan"):
 *
 *   Kode aplikasi (html, js, css, json) -> JARINGAN DULU
 *     Kalau offline, pakai cache. Ini penting karena aplikasi ini berubah
 *     sering; kalau kodenya di-cache agresif, perbaikan tidak akan pernah
 *     sampai ke pengguna yang sedang membuka aplikasi.
 *
 *   Aset immutable (ikon, font) -> CACHE DULU
 *     Namanya tidak berubah, jadi aman disimpan lama.
 *
 * SYARAT: JANGAN pernah menutupi cache kode tanpa menaikkan VERSI.
 * Kalau tidak, cache lama tidak akan dibuang.
 */
const VERSI = 'ctc-v3';

const KODE = ['.html', '.js', '.css', '.json', ''];
const ASET = ['.png', '.svg', '.woff2', '.woff', '.ico'];

const CANGKAR = [
  './',
  './index.html',
  './app.webmanifest.json',
  './css/tokens.css',
  './css/ui.css',
  './css/views.css',
  './js/konfigurasi.js',
  './js/scale.js',
  './js/auth.js',
  './js/api.js',
  './js/ui.js',
  './js/tampilan.js',
  './js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSI)
      .then((c) => c.addAll(CANGKAR))
      // satu berkas gagal tidak boleh menggagalkan seluruh pemasangan
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((kunci) => Promise.all(kunci.filter((k) => k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const ekstensi = (url) => {
  const p = url.pathname.toLowerCase();
  if (ASET.some((x) => p.endsWith(x))) return 'aset';
  if (KODE.some((x) => p.endsWith(x))) return 'kode';
  return 'lain';
};

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // ---- halaman: jaringan dulu, cache sebagai cadangan ----
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r && r.ok) { const s = r.clone(); caches.open(VERSI).then((c) => c.put(e.request, s)).catch(() => {}); }
          return r;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  const jenis = ekstensi(url);

  // ---- aset immutable: cache dulu ----
  if (jenis === 'aset') {
    e.respondWith(
      caches.match(e.request).then((tersimpan) => tersimpan || fetch(e.request).then((r) => {
        if (r && r.ok) { const s = r.clone(); caches.open(VERSI).then((c) => c.put(e.request, s)).catch(() => {}); }
        return r;
      }))
    );
    return;
  }

  // ---- kode aplikasi: JARINGAN DULU ----
  // Inilah yang membuat perbaikan benar-benar sampai ke pengguna.
  if (jenis === 'kode') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r && r.ok) {
            const s = r.clone();
            caches.open(VERSI).then((c) => c.put(e.request, s)).catch(() => {});
          }
          return r;
        })
        .catch(() => caches.match(e.request).then((t) => t || Response.error()))
    );
    return;
  }

  // ---- lain-lain: AMAKAN ----
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then((t) => t || Response.error()))
  );
});

/** Pembersih cache manual, dipanggil lewat postMessage dari aplikasi. */
self.addEventListener('message', async (e) => {
  if (!e.data || e.data.tipe !== 'bersihkanCache') return;
  const bersihkan = async () => {
    const kunci = await caches.keys();
    await Promise.all(kunci.filter((k) => k !== VERSI).map((k) => caches.delete(k)));
    const c = await caches.open(VERSI);
    const req = await c.keys();
    await Promise.all(req.map((r) => c.delete(r)));
  };
  try {
    await bersihkan();
    if (e.source) e.source.postMessage({ ok: true });
  } catch (err) {
    if (e.source) e.source.postMessage({ ok: false, pesan: String(err) });
  }
});