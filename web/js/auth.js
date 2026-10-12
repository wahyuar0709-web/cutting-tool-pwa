/* ==========================================================================
   auth.js — masuk dengan akun Google.

   Token ID disimpan di memori dan sessionStorage. Token berlaku 1 jam;
   kalau sudah tinggal < 50 menit, diam-diam minta token baru selama
   akun masih terhubung. Kalau gagal, pengguna diminta masuk lagi.

   Token TIDAK pernah disimpan di localStorage — kalau peramban dipakai
   orang lain, token-nya akan ikut terbaca sampai tab ditutup.
   ========================================================================== */

const Auth = (() => {
  let token = null;
  let masaBerlaku = 0;
  let profil = null;

  const KUNCI = 'ctc-token';
  const bersiap = new Promise((res) => {
    if (window.google?.accounts?.id) return res();
    window.addEventListener('load', () => res());
  });

  function simpan(t, kedaluwarsa) {
    token = t;
    masaBerlaku = kedaluwarsa || (Date.now() + 3600 * 1000);
    try {
      sessionStorage.setItem(KUNCI, JSON.stringify({ t: token, s: masaBerlaku }));
    } catch { /* penyimpanan diblokir; token tetap jalan di memori */ }
  }

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
    token = null; masaBerlaku = 0; profil = null;
    try { sessionStorage.removeItem(KUNCI); } catch { /* abaikan */ }
  }

  /** true kalau ada CLIENT_ID yang bisa dipakai. */
  function bisaMasuk() {
    return !!(KONFIGURASI.CLIENT_ID && window.google?.accounts?.id);
  }

  function siap() {
    if (!bisaMasuk()) return false;
    google.accounts.id.initialize({
      client_id: KONFIGURASI.CLIENT_ID,
      callback: (balasan) => {
        if (!balasan || balasan.credential !== 'undefined') simpan(balasan.credential);
      },
      ux_mode: 'popup',
      context: 'signin',
    });
    return true;
  }

  /** Ambil token. Kalau ada yang lama masih aman, pakai itu. */
  async function tokenAktif() {
    await bersiap;
    if (!bisaMasuk()) return null;
    if (token && Date.now() < masaBerlaku - KONFIGURASI.SEGAR_SESUDAH_MS) return token;
    if (bacaTersimpan()) return token;
    return mintaToken();
  }

  function mintaToken() {
    return new Promise((res, rej) => {
      if (!bisaMasuk()) return rej(new Error('CLIENT_ID belum diisi.'));
      google.accounts.id.initialize({
        client_id: KONFIGURASI.CLIENT_ID,
        callback: (b) => {
          if (b && b.credential && b.credential !== 'undefined') { simpan(b.credential); res(b.credential); }
          else rej(new Error('Login dibatalkan.'));
        },
        ux_mode: 'popup',
        context: 'signin',
      });
      google.accounts.id.prompt((notif) => {
        if (notif.isNotDisplayed() || notif.isSkippedMoment()) {
          // popup diblokir atau tidak langsung tampil -> tampilkan tombol
          const wadah = document.getElementById('wadah-google');
          if (wadah && !wadah.childElementCount) {
            google.accounts.id.renderButton(wadah, { theme: 'outline', size: 'large', shape: 'rectangular', text: 'continue_with' });
          }
          return;
        }
      });
      setTimeout(() => { if (!token) rej(new Error('Waktu masuk habis.')); }, 60000);
    });
  }

  return {
    bisaMasuk,
    tokenAktif,
    siap,
    hapus,
    get profil() { return profil; },
    set profil(p) { profil = p; },
    get sudahMasuk() { return !!token; },
  };
})();

window.Auth = Auth;