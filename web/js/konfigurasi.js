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
  API_URL: 'https://script.google.com/macros/s/AKfycbwfrkUuMw7JZbRY8xo6ezMYCNodnveDhEv7mz3MrvXt5FDAAunZ3mwKjoYa6FaZVQmF/exec',

/**
   * Harus sama dengan BUILD di src/Config.gs.
   * Frontend memanggil ping saat start; kalau build di server beda, aplikasi
   * memberi tahu bahwa frontend perlu diperbarui, bukan diam-diam gagal.
   * Deployment Apps Script mengunci kode pada versi saat dibuat, jadi mendorong
   * kode baru tidak otomatis mengubah versi yang sedang hidup.
   */
  BUILD_DIHARAPKAN: '2026-10-12-01',

  CLIENT_ID: '295783259439-da4h29qv4jual9kmth94gb1akv5jhb2j.apps.googleusercontent.com',

  // Where the app is hosted; listed in Authorized JavaScript origins
  ASAL: 'https://wahyuar0709-web.github.io',

  // Token Google ID is valid for 1 hour; renew before it expires
  SEGAR_SESUDAH_MS: 50 * 60 * 1000,
};

window.KONFIGURASI = KONFIGURASI;