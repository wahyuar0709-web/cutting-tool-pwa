/* ==========================================================================
   konfigurasi.js — nilai yang perlu diisi satu kali.

   CLIENT_ID: Google Cloud Console → APIs & Services → Credentials →
              Create credentials → OAuth client ID → Application type: Web
              Application → Authorized JavaScript origins:
              https://wahyuar0709-web.github.io
              (dan http://localhost kalau diuji di komputer)

   Kosongkan sementara kalau belum punya: aplikasi tetap jalan dalam
   mode pratinjau, hanya tidak bisa tersambung ke data nyata.
   ========================================================================== */

const KONFIGURASI = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwQnHFKF3M89o6Gpn6Pcz2T2MVbUL1eiIpIFqjiIAm7K7can9kdYO4paCeueFLG8z4i/exec',

  CLIENT_ID: '',

  // Where the app is hosted; listed in Authorized JavaScript origins
  ASAL: 'https://wahyuar0709-web.github.io',

  // Token Google ID is valid for 1 hour; renew before it expires
  SEGAR_SESUDAH_MS: 50 * 60 * 1000,
};

window.KONFIGURASI = KONFIGURASI;