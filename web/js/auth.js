/* ==========================================================================
   auth.js — masuk dengan akun Google.

   Token ID disimpan di memori dan sessionStorage. Token berlaku 1 jam;
   kalau sudah tinggal < 50 menit, diminta token baru.

   Token TIDAK pernah disimpan di localStorage — kalau peramban dipakai
   orang lain, token-nya akan ikut terbaca sampai tab ditutup.

   Catatan: One Tap (google.accounts.id.prompt) sengaja TIDAK dipakai.
   FedCM akan menjadi wajib, dan prompt() sudah menghasilkan AbortError
   serta "initialize() is called multiple times". Tombol yang dirender
   sendiri lebih sederhana dan tidak bermasalah.
   ========================================================================== */

const Auth = (() => {
  let token = null;
  let masaBerlaku = 0;
  let sudahInisialisasi = false;

  const KUNCI = 'ctc-token';

  function simpan(t, kedaluwarsaMs) {
    token = t;
    masaBerlaku = kedaluwarsaMs || (Date.now() + 3600 * 1000);
    try {
      sessionStorage.setItem(KUNCI, JSON.stringify({ t: token, s: masaBerlaku }));
    } catch { /* penyimpanan diblokir; token tetap jalan di memori */ }
    if (typeof onTokenBaru === 'function') onTokenBaru(token);
  }

  let onTokenBaru = null;

  function bacaTersimpan() {
    try {
      const mentah = sessionStorage.getItem(KUNCI);
      if (!mentah) return false;
      const x = JSON.parse(mentah);
      if (Date.now() < x.s - KONFIGURASI.SEGAR_SESUDAH_MS) { token = x.t; masaBerlaku = x.s; return true; }
    } catch { /* abaikan */ }
    return false;
  }

  function hapus() {
    token = null; masaBerlaku = 0;
    try { sessionStorage.removeItem(KUNCI); } catch { /* abaikan */ }
  }

  /** true kalau CLIENT_ID terisi dan pustaka Google sudah termuat. */
  function bisaMasuk() {
    return !!(KONFIGURASI.CLIENT_ID && window.google?.accounts?.id);
  }

  /** Pustaka Google dimuat? */
  const pustakaDimuat = () => !!(window.google?.accounts?.id);

  /** Inisialisasi HANYA SEKALI. initialize() berulang memicu peringatan dan merusak keadaan token. */
  function inisialisasi() {
    if (sudahInisialisasi) return true;
    if (!bisaMasuk()) return false;
    google.accounts.id.initialize({
      client_id: KONFIGURASI.CLIENT_ID,
      callback: (balasan) => {
        if (balasan && typeof balasan.credential === 'string' && balasan.credential !== 'undefined') {
          simpan(balasan.credential);
        }
      },
      ux_mode: 'popup',
      cancel_on_tap_outside: false,
      auto_select: true,
    });
    sudahInisialisasi = true;
    return true;
  }

  /** Tampilkan tombol Google ke dalam wadah yang diberikan. */
  function pasangTombol(wadah, opsi) {
    if (!inisialisasi()) return false;
    wadah.innerHTML = '';
    google.accounts.id.renderButton(wadah, Object.assign({
      theme: 'outline', size: 'large', shape: 'rectangular', text: 'continue_with',
    }, opsi || {}));
    return true;
  }

  /** Tunggu token muncul dari klik tombol. */
  function tungguToken(ms) {
    return new Promise((res, rej) => {
      if (token) return res(token);
      const selang = setInterval(() => {
        if (token) { clearInterval(selang); res(token); }
      }, 200);
      setTimeout(() => { clearInterval(selang); if (!token) rej(new Error('Waktu masuk habis.')); }, ms || 90000);
    });
  }

  /** Ambil token yang masih berlaku, atau null kalau belum masuk. */
  function tokenAktif() {
    if (token && Date.now() < masaBerlaku - KONFIGURASI.SEGAR_SESUDAH_MS) return Promise.resolve(token);
    if (bacaTersimpan()) return Promise.resolve(token);
    return Promise.resolve(null);
  }

  return {
    bisaMasuk,
    pustakaDimuat,
    inisialisasi,
    pasangTombol,
    tungguToken,
    tokenAktif,
    hapus,
    saatTokenBaru(fn) { onTokenBaru = fn; },
    get sudahMasuk() { return !!token; },
  };
})();

window.Auth = Auth;