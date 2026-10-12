/* ==========================================================================
   app.js — pencemaran: muat profil, bangun navigasi sesuai peran, render layar.
   ========================================================================== */

const App = {
  state: { layar: null, kartuKode: '', profil: null },
  cache: { referensi: null, kartu: null },

/* ---------------------------------------------------------------- mulai */
  async boot() {
    // Tanpa CLIENT_ID, aplikasi langsung masuk mode pratinjau.
    if (!KONFIGURASI.CLIENT_ID) { this.bootPratinjau(); return; }
    await this.tampilkanMasuk();

    const r = await Api.whoami();
    if (!r.ok) {
      if (r.perluMasuk || /token|Belum masuk/i.test(r.pesan || '')) { this.sembunyikanMasuk(); return; }
      this.sembunyikanMasuk();
      UI.toast(r.pesan || 'Tidak bisa masuk.', 'gagal');
      return;
    }
    this.sembunyikanMasuk();
    await this.mulaiDengan(r.data);
  },

  /** Tampilkan layar masuk dengan tombol Google. */
  async tampilkanMasuk() {
    const el = document.getElementById('masuk');
    const pesan = document.getElementById('masuk-pesan');
    el.hidden = false;
    pesan.innerHTML = '<span class="memuat"></span>';

    // Tunggu Google Identity Services termuat
    for (let i = 0; i < 40 && !window.google?.accounts?.id; i++) {
      await new Promise((r) => setTimeout(r, 150));
    }
    if (!window.google?.accounts?.id) {
      pesan.innerHTML = '<div class="pesan gagal">Google Identity Services gagal dimuat. Periksa koneksi internet.</div>';
      return;
    }
    pesan.innerHTML = '';
    Auth.siap();
    google.accounts.id.renderButton(document.getElementById('wadah-google'), {
      theme: 'outline', size: 'large', shape: 'rectangular', text: 'continue_with',
    });

    document.getElementById('ke-pratinjau').onclick = (e) => { e.preventDefault(); this.bootPratinjau(); };
  },

  sembunyikanMasuk() { document.getElementById('masuk').hidden = true; },

  /** Mode pratinjau: data dari berkas, tanpa menulis. */
  async bootPratinjau() {
    this.sembunyikanMasuk();
    document.getElementById('saya').innerHTML =
      '<span class="peran" data-p="SPV">PRATINJAU</span><b>Data contoh</b>';
    document.body.classList.add('mode-pratinjau');

    const refs = await Api.referensi();
    this.cache.referensi = refs.ok ? refs.data : null;
    this.state.profil = { peran: 'ADMIN', nama: 'Pratinjau', izin: ['dashboard', 'stok', 'kartu', 'tiket.buat', 'tiket.lihat', 'master', 'ekspor'] };
    document.getElementById('rangka').dataset.peran = 'ADMIN';
    this.bangunNav();
    const pertama = this.navTersedia()[0];
    this.pergi(pertima ? pertama.kunci : 'ringkasan');
  },

  /** Mulai aplikasi setelah identitas diketahui. */
  async mulaiDengan(profil) {
    this.state.profil = profil;
    document.getElementById('rangka').dataset.peran = profil.peran;
    document.getElementById('saya').innerHTML =
      `<span class="peran" data-p="${UI.esc(profil.peran)}">${UI.esc(profil.peran)}</span><b>${UI.esc(profil.nama)}</b>`;

    const refs = await Api.referensi();
    this.cache.referensi = refs.ok ? refs.data : null;

    this.bangunNav();
    const pertama = this.navTersedia()[0];
    this.pergi(pertima ? pertama.kunci : 'ringkasan');
  },

  /* ---------------------------------------------------------------- navigasi */
  navTersedia() {
    const peran = this.state.profil?.peran;
    return Object.entries(Layar).filter(([, l]) => l.peran.includes(peran));
  },

  bangunNav() {
    const nav = document.getElementById('nav');
    const daftar = this.navTersedia();
    nav.innerHTML = '<span class="nav-judul">Cutting Tool</span>' +
      daftar.map(([kunci, l]) =>
        `<button class="nav-item" data-layar="${kunci}" title="${UI.esc(l.judul)}">
           <svg viewBox="0 0 24 24" aria-hidden="true">${l.ikon}</svg><span>${UI.esc(l.nav)}</span>
         </button>`).join('');
    nav.hidden = daftar.length <= 1;
    nav.querySelectorAll('[data-layar]').forEach((b) => {
      b.onclick = () => this.pergi(b.dataset.layar);
    });
  },

  /* ---------------------------------------------------------------- render */
  async pergi(kunci) {
    const layar = Layar[kunci];
    if (!layar) return;
    if (!layar.peran.includes(this.state.profil?.peran)) {
      this.toast('Peran ' + (this.state.profil?.peran || '') + ' tidak punya akses ke layar ini.');
      return;
    }
    this.state.layar = kunci;
    document.getElementById('judul').textContent = layar.judul;

    document.querySelectorAll('#nav [data-layar]').forEach((b) => {
      if (b.dataset.layar === kunci) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });

    const isi = document.getElementById('isi');
    isi.innerHTML = '<div class="kosong"><span class="memuat"></span></div>';
    try {
      await layar.render(isi, this);
    } catch (e) {
      isi.innerHTML = `<div class="pesan gagal">${UI.esc(e.message || 'Layar gagal dimuat.')}</div>`;
    }

    // skala nonius digambar setelah DOM siap
    if (kunci === 'kartu' && this.cache.kartu) {
      const d = this.cache.kartu;
      const paling = d.units.reduce((a, u) => (u.regrind > (a?.regrind ?? -1) ? u : a), null);
      const wadah = document.getElementById('skala-utama');
      if (wadah && paling) {
        wadah.dataset.maks = String(paling.maks || 1);
        renderSkala(wadah, { nilai: paling.regrind, maks: paling.maks, label: 'Sudah asah', satuan: 'kali' });
      }
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  },

  render() { return this.pergi(this.state.layar); },
  toast(p) { UI.toast(p); },
};

document.addEventListener('DOMContentLoaded', () => {
  daftarSW();
  App.boot();
});

/**
 * Daftarkan service worker supaya aplikasi tetap bisa dibuka tanpa sinyal.
 * Lantai produksi sering punya sinyal jelek; kerangkanya harus tetap muncul.
 */
function daftarSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;  // tidak jalan saat dibuka langsung dari disk
  navigator.serviceWorker.register('sw.js').catch(() => {
    // diam-diam saja: tanpa service worker aplikasi tetap jalan, hanya tidak offline
  });
}

window.App = App;