/* ==========================================================================
   app.js — pencemaran: muat profil, bangun navigasi sesuai peran, render layar.
   ========================================================================== */

const App = {
  state: { layar: null, kartuKode: '', profil: null },
  cache: { referensi: null, kartu: null },

  /* ---------------------------------------------------------------- mulai */
  async boot() {
    const isi = document.getElementById('isi');
    const r = await Api.whoami();

    if (!r.ok) {
      isi.innerHTML = `<div class="panel"><h2>Belum bisa masuk</h2><div class="pesan gagal">${UI.esc(r.pesan)}</div>
        <p class="ket">Aplikasi ini hanya terbuka untuk akun Google yang terdaftar di sheet <span class="mono">Master User</span>.</p></div>`;
      return;
    }

    // Di luar Apps Script (mis. GitHub Pages), data dibaca dari berkas
    // pratinjau. Tandai dengan jelas supaya tidak tertukar dengan data nyata.
    const pratinjau = !Api.tersambung();
    this.state.profil = r.data;
    document.getElementById('rangka').dataset.peran = r.data.peran;
    document.getElementById('saya').innerHTML =
      (pratinjau ? '<span class="peran" data-p="SPV">PRATINJAU</span>' : `<span class="peran" data-p="${UI.esc(r.data.peran)}">${UI.esc(r.data.peran)}</span>`) +
      `<b>${UI.esc(pratinjau ? 'Data contoh' : r.data.nama)}</b>`;

    if (pratinjau) document.body.classList.add('mode-pratinjau');

    // referensi dibutuhkan hampir semua layar
    const refs = await Api.referensi();
    this.cache.referensi = refs.ok ? refs.data : null;

    this.bangunNav();
    const pertama = this.navTersedia()[0];
    this.pergi(pertama ? pertama.kunci : 'ringkasan');
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