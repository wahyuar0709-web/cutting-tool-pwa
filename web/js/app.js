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

    // ?pratinjau=1 (atau #pratinjau) membuka mode contoh tanpa login.
    // Dipakai untuk demo, pelatihan, dan pemeriksaan tampilan otomatis.
    // Data pratinjau hanya baca, jadi tidak ada risiko menimpa data nyata.
    const param = new URLSearchParams(location.search);
    if (param.get('pratinjau') === '1' || location.hash === '#pratinjau') { this.bootPratinjau(); return; }

    // Cek versi backend dulu. Deployment Apps Script mengunci kode pada versi
    // saat dibuat, jadi frontend bisa lebih baru daripada server -- atau
    // sebaliknya. Lebih baik diberi tahu daripada gagal diam-diam.
    await this.cekVersiBackend();

    await this.tampilkanMasuk();

    // Kalau masih ada token yang berlaku, langsung masuk tanpa mengganggu pengguna.
    const ada = await Auth.tokenAktif();
    if (!ada) return;

    const profil = await this.ambilProfil();
    if (!profil) {
      // Token ada tapi server menolaknya. Jangan panggil mulaiDengan(null):
      // itu bikin "Cannot read properties of null (reading 'peran')" dan
      // pengguna	left menggantung di spinner tanpa tahu apa yang salah.
      this.sembunyikanMasuk();
      Auth.hapus();
      await this.tampilkanMasuk();
      document.getElementById('masuk-pesan').innerHTML =
        '<div class="pesan gagal">Sesi sebelumnya ditolak server. Masuk sekali lagi.</div>';
      return;
    }
    this.sembunyikanMasuk();
    await this.mulaiDengan(profil);
  },

  /** Tampilkan penyebab penolakan server, persis seperti yang dikirim backend. */
  async tampilkanKenapaGagal() {
    const kotak = document.getElementById('masuk-pesan');
    if (!kotak) return;
    const alasan = this.alasanGagal || 'Server menolak permintaan tanpa keterangan.';
    kotak.innerHTML = `<div class="pesan gagal"><b>Server menolak:</b> ${UI.esc(alasan)}</div>`;

    const diag = await Api.diagnostik();
    if (diag && diag.ok) {
      const d = diag.data || {};
      const baris = [
        'CLIENT_ID terisi: ' + (d.clientIdTerisi ? 'ya' : 'TIDAK'),
        'Sheet Master User terbaca: ' + (d.sheetTerbaca ? 'ya' : 'tidak') + ' — ' + (d.barisMasterUser || 0) + ' baris',
        'Pengguna terdaftar: ' + ((d.pengguna || []).map((p) => `${p.email} (${p.peran}${p.aktif === 'Y' ? '' : ', nonaktif'})`).join(', ') || 'tidak ada'),
        'UrlFetchApp: ' + String(d.urlFetchApp || 'tidak diketahui'),
      ];
      kotak.innerHTML += '<div class="pesan gagal" style="border-left-color:var(--dekat);background:var(--dekat-l)">' +
        '<b>Hasil pemeriksaan server:</b><ul style="margin:6px 0 0 16px">' +
        baris.map((b) => `<li>${UI.esc(b)}</li>`).join('') + '</ul></div>';
    }
  },

  /** Ambil profil dari server. Kembalikan null kalau gagal (alasanDisimpan di this.alasanGagal). */
  async ambilProfil() {
    const r = await Api.whoami();
    if (!r.ok) { UI.toast(r.pesan || 'Tidak bisa masuk.', 'gagal'); this.alasanGagal = r.pesan || 'Server menolak.'; return null; }
    if (!r.data || !r.data.peran) {
      this.alasanGagal = 'Server tidak mengembalikan peran pengguna.';
      UI.toast(this.alasanGagal, 'gagal');
      return null;
    }
    return r.data;
  },

  /**
 * Bandingkan BUILD backend dengan BUILD_DIHARAPKAN frontend.
 * Mismatch berarti salah satu sisi belum diperbarui.
 */
  async cekVersiBackend() {
    const p = await Api.periksaServer();
    if (!p.ok) {
      this.pesanVersi = 'Backend tidak terjangkau: ' + (p.pesan || '') + ' — aplikasi mungkin tidak bisa dipakai.';
      return;
    }
    const build = p.data && p.data.build;
    if (!build) {
      this.pesanVersi = 'Backend masih menjalankan versi lama (tidak ada nomor build). '
        + 'Deploy ulang web app di Apps Script: Deploy → Manage deployments → ikon pensil → New version → Deploy.';
      return;
    }
    if (build !== KONFIGURASI.BUILD_DIHARAPKAN) {
      this.pesanVersi = 'Versi tidak sama. Frontend punya ' + KONFIGURASI.BUILD_DIHARAPKAN
        + ', backend punya ' + build + '. Deploy ulang web app di Apps Script.';
    }
  },

  /** Tampilkan layar masuk dengan tombol Google. */
  async tampilkanMasuk() {
    const el = document.getElementById('masuk');
    const pesan = document.getElementById('masuk-pesan');
    el.hidden = false;
    pesan.innerHTML = '<span class="memuat"></span>';

    // Tunggu pustaka Google termuat (maks 8 detik)
    for (let i = 0; i < 54 && !Auth.pustakaDimuat(); i++) {
      await new Promise((r) => setTimeout(r, 150));
    }
    if (!Auth.pustakaDimuat()) {
      pesan.innerHTML = '<div class="pesan gagal">Google Identity Services gagal dimuat. Periksa koneksi internet, lalu muat ulang halaman.</div>';
      return;
    }
    pesan.innerHTML = '';

    const wadah = document.getElementById('wadah-google');
    Auth.pasangTombol(wadah);
    if (this.pesanVersi) {
      pesan.innerHTML = '<div class="pesan" style="border-left-color:var(--dekat);background:var(--dekat-l)">'
        + UI.esc(this.pesanVersi) + '</div>';
    }
    document.getElementById('ke-pratinjau').onclick = (e) => { e.preventDefault(); this.bootPratinjau(); };
    Auth.saatTokenBaru(async () => {
      const profil = await this.ambilProfil();
      if (!profil) { this.tampilkanKenapaGagal(); return; }
      this.sembunyikanMasuk();
      if (profil) await this.mulaiDengan(profil);
    });
  },

  sembunyikanMasuk() { document.getElementById('masuk').hidden = true; },

  /** Mode pratinjau: data dari berkas, tanpa menulis. */
  async bootPratinjau() {
    // Paksa Api memakai berkas pratinjau. Tanpa ini, CLIENT_ID yang terisi
    // membuat Api menghubungi backend sungguhan tanpa token, dan layar
    // tidak pernah selesai dimuat.
    Api.aktifkanPratinjau(true);
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
    // navTersedia() mengembalikan pasangan [kunci, objek]; ambil indeks 0, bukan .kunci
    this.pergi(pertama ? pertama[0] : Layar.UTAMA);
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
    // navTersedia() mengembalikan pasangan [kunci, objek]; ambil indeks 0, bukan .kunci
    this.pergi(pertama ? pertama[0] : Layar.UTAMA);
  },

  /* ---------------------------------------------------------------- navigasi */
  navTersedia() {
    const peran = this.state.profil?.peran;
    // Layar.UTAMA adalah string, bukan objek layar — jangan ikut jadi menu.
    return Object.entries(Layar).filter(([, l]) => l && Array.isArray(l.peran) && l.peran.includes(peran));
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
  /**
   * Pindah layar.
   * dariRiwayat = true kalau pemicuannya tombol back browser. Tanpa begitu,
   * tiap back akan menambah satu entri baru dan pengguna tidak bisa keluar.
   */
  async pergi(kunci, dariRiwayat) {
    const layar = Layar[kunci];
    if (!layar) return;
    if (!layar.peran.includes(this.state.profil?.peran)) {
      this.toast('Peran ' + (this.state.profil?.peran || '') + ' tidak punya akses ke layar ini.');
      return;
    }

    // Rekam layar sekarang agar tombol back punya titik awal yang jelas.
    if (!dariRiwayat) {
      try {
        const url = kunci === Layar.UTAMA ? location.pathname + location.search : '#' + kunci;
        history.pushState({ layar: kunci }, '', url);
      } catch { /* riwayat browser tidak tersedia; navigasi tetap jalan */ }
    }

    this.state.layar = kunci;
    document.getElementById('judul').textContent = layar.judul;

    document.querySelectorAll('#nav [data-layar]').forEach((b) => {
      if (b.dataset.layar === kunci) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });

    const isi = document.getElementById('isi');
    // aria-busy memberi tahu pembaca layar bahwa isinya sedang diganti.
    isi.setAttribute('aria-busy', 'true');
    isi.innerHTML = '<div class="kosong"><span class="memuat"></span></div>';
    try {
      await layar.render(isi, this);
    } catch (e) {
      isi.innerHTML = `<div class="pesan gagal">${UI.esc(e.message || 'Layar gagal dimuat.')}</div>`;
    }
    isi.removeAttribute('aria-busy');

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

    // Fokus pindah ke konten: pembaca layar/Linux perlu tahu layarnya berubah,
    // dan pengguna keyboard tidak boleh terjebak di navigasi.
    // Jangan dilakukan pada render pertama — melompat fokus begitu halaman
    // terbuka justru membingungkan.
    if (this.sudahNavigasi) isi.focus({ preventScroll: true });
    this.sudahNavigasi = true;
  },

  render() { return this.pergi(this.state.layar); },
  toast(p) { UI.toast(p); },
};

document.addEventListener('DOMContentLoaded', () => {
  daftarSW();
  pasangPenangkapKesalahan();
  watchdog();
  App.boot();

  // Tombol back / maju browser harus memindahkan layar, bukan mengeluarkan
  // pengguna dari aplikasi di tengah pekerjaan.
  window.addEventListener('popstate', (e) => {
    const kunci = (e.state && e.state.layar) || Layar.UTAMA;
    if (App.state.profil) App.pergi(kunci, true);
  });

  // Buka langsung ke layar tertentu lewat #kartu, #ringkasan, dan sejenisnya.
  const dariHash = (location.hash || '').replace('#', '');
  if (Layar[dariHash]) {
    App.pergi(dariHash, true);
  } else {
    try { history.replaceState({ layar: Layar.UTAMA }, '', location.pathname + location.search); } catch { /* abaikan */ }
  }
});

/**
 * Tangkap kesalahan yang tidak tertangani.
 *
 * Tanpa ini, satu kesalahan kecil membuat halaman diam-diam menggantung di
 * spinner dan pengguna hanya bisa menebak-nebak. Dengan ini, kesalahannya
 * ditulis di layar dalam Bahasa Indonesia beserta cara memperbaikinya.
 */
function pasangPenangkapKesalahan() {
  const tampilkan = (judul, detail) => {
    const isi = document.getElementById('isi');
    if (!isi) return;
    // jangan timpa tampilan yang sudah jadi
    if (isi.querySelector('.kartu-penyebab')) return;
    isi.innerHTML =
      `<section class="panel kartu-penyebab">
         <h2>${UI.esc(judul)}</h2>
         <div class="pesan gagal">${UI.esc(detail || '')}</div>
         <p class="ket">Yang bisa dicoba:</p>
         <ul class="ket">
           <li>Muat ulang halaman dengan <span class="mono">Ctrl+Shift+R</span> (menghapus cache).</li>
           <li>Pastikan backend Apps Script sudah di-deploy versi terbaru.</li>
           <li>Buka F12 (menu Console), cari pesan merah pertama, kirimkan kalau masih gagal.</li>
         </ul>
         <p><button class="tombol" onclick="location.reload()">Muat ulang</button>
            <button class="tombol halus" id="ke-pratinjau2">Lihat pratinjau</button></p>
       </section>`;
    const t = document.getElementById('ke-pratinjau2');
    if (t) t.onclick = () => App.bootPratinjau();
  };

  window.addEventListener('error', (e) => {
    tampilkan('Ada kesalahan di halaman', (e.message || 'Kesalahan tidak dikenal') + ' — ' + (e.filename || '') + ' baris ' + (e.lineno || '?'));
  });

  window.addEventListener('unhandledrejection', (e) => {
    const a = e.reason;
    const pesan = (a && (a.message || a.pesan)) || String(a || 'Kesalahan tidak dikenal');
    tampilkan('Permintaan gagal diproses', pesan);
  });
}

/**
 * Watchdog: kalau 15 detik setelah halaman dimuat belum ada apa-apa yang
 * dirender, tampilkan diagnosis alih-alih membiarkan spinner berputar.
 */
function watchdog() {
  setTimeout(() => {
    const isi = document.getElementById('isi');
    const masuk = document.getElementById('masuk');
    const masukTerbuka = masuk && !masuk.hidden;
    const isiKosong = isi && !isi.querySelector('.panel') && !isi.querySelector('.kartu-penyebab');
    if (isiKosong && !masukTerbuka) {
      isi.innerHTML =
        `<section class="panel kartu-penyebab">
           <h2>Halaman belum selesai memuat</h2>
           <div class="pesan gagal">Setelah 15 detik tidak ada yang tampil. Kemungkinan pustaka Google tidak termuat, atau ada kesalahan JavaScript.</div>
           <p class="ket">Periksa F12 (menu Console) untuk pesan merah pertama.</p>
           <p><button class="tombol" onclick="location.reload()">Muat ulang</button>
              <button class="tombol halus" id="ke-pratinjau3">Lihat pratinjau dengan data contoh</button></p>
         </section>`;
      const t = document.getElementById('ke-pratinjau3');
      if (t) t.onclick = () => App.bootPratinjau();
    }
  }, 15000);
}

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