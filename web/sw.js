/**
 * sw.js — service worker.
 *
 * Aplikasi dibuka di lantai produksi yang sinyalnya sering jelek, jadi
 * cangkang (shell) harus tetap bisa dibuka tanpa internet. Data tetap
 * diambil dari server saat ada koneksi.
 */
const VERSI = 'ctc-v2';
const CANGKAR = [
  './',
  './index.html',
  './app.webmanifest.json',
  './css/tokens.css',
  './css/ui.css',
  './css/views.css',
  './js/scale.js',
  './js/api.js',
  './js/ui.js',
  './js/tampilan.js',
  './js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(CANGKAR)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((kunci) => Promise.all(kunci.filter((k) => k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // halaman: jaringan dulu, cache sebagai cadangan
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    return;
  }

  // Aset statis: cache dulu, lalu perbarui di belakang.
  //
  // PENTING: pakai r.clone() saat menyimpan. Kalau r disimpan apa adanya,
  // badan responsnya sudah dianggap habis, lalu "Response body is already used"
  // saat respons yang sama dikembalikan ke halaman.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const jaringan = fetch(e.request).then((r) => {
        if (r && r.status === 200 && r.type === 'basic') {
          const salinan = r.clone();
          caches.open(VERSI).then((c) => c.put(e.request, salinan)).catch(() => {});
        }
        return r;
      }).catch(() => cached);
      return cached || jaringan;
    })
  );
});