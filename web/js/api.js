/* ==========================================================================
   api.js — jembatan ke backend Apps Script.

   Dua jalur:
   1.-mode app  : google.script.run (hanya ada di dalam Apps Script)
   2. mode pratinjau: berkas data/pratinjau.json (isi nyata dari spreadsheet)

   Semua fungsi mengembalikan {ok, data, pesan, detail}. Tidak ada error yang
   dibiarkan sampai ke layar sebagai exception.
   ========================================================================== */

const Api = (() => {
  let modePratinjau = false;
  let cachePratinjau = null;

  async function muatPratinjau() {
    if (cachePratinjau) return cachePratinjau;
    const r = await fetch('data/pratinjau.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('berkas pratinjau tidak bisa dibaca (' + r.status + ')');
    cachePratinjau = await r.json();
    return cachePratinjau;
  }

  async function dariServer(nama, args) {
    return new Promise((res) => {
      google.script.run
        .withSuccessHandler((r) => res(normalisasi(r)))
        .withFailureHandler((e) => res({ ok: false, pesan: String((e && e.message) || e || 'Gagal menghubungi server.'), detail: [] }))[nama](...args);
    });
  }

  async function dariPratinjau(nama, args) {
    try {
      const d = await muatPratinjau();
      switch (nama) {
        case 'api_whoami':         return { ok: true, data: d.profil };
        case 'api_referensi':      return { ok: true, data: d.referensi };
        case 'api_dashboard':      return { ok: true, data: d.dashboard };
        case 'api_kartuAlat':      return { ok: true, data: d.kartu };
        case 'api_daftarTiket':    return { ok: true, data: d.daftarTiket || [] };
        case 'api_healthCheck':    return { ok: true, data: d.healthCheck };
        // MENULIS tidak boleh jalan di pratinjau: pratinjau membaca spreadsheet,
        // menulisinya berarti menulis ke data produksi tanpa sengaja.
        default: return { ok: false, pesan: 'Mode pratinjau hanya bisa dibaca. Jalankan dari Apps Script untuk menulis.', detail: [] };
      }
    } catch (e) {
      return { ok: false, pesan: 'Pratinjau tidak bisa dimuat: ' + (e.message || e), detail: [] };
    }
  }

  function normalisasi(r) {
    if (!r || typeof r !== 'object') return { ok: false, pesan: 'Respons server tidak dimengerti.', detail: [] };
    return {
      ok: !!r.ok,
      data: r.data ?? null,
      pesan: r.pesan || r.info || '',
      detail: Array.isArray(r.detail) ? r.detail : (r.masalah || []),
    };
  }

  const adaServer = () => typeof google !== 'undefined' && !!google.script && !!google.script.run;

  async function panggil(nama, ...args) {
    if (modePratinjau) return dariPratinjau(nama, args);
    if (!adaServer()) return dariPratinjau(nama, args);   // GitHub Pages dll.
    return dariServer(nama, args);
  }

  return {
    /** true kalau benar-benar sedang berjalan di dalam Apps Script */
    tersambung: adaServer,
    paksaPratinjau(v) { modePratinjau = !!v; },
    whoami: () => panggil('api_whoami'),
    referensi: () => panggil('api_referensi'),
    dashboard: () => panggil('api_dashboard'),
    kartuAlat: (kode) => panggil('api_kartuAlat', kode),
    buatTicket: (t) => panggil('api_buatTicket', t),
    daftarTiket: (f) => panggil('api_daftarTiket', f),
    catatMovement: (m) => panggil('api_catatMovement', m),
    healthCheck: () => panggil('api_healthCheck'),
  };
})();

window.Api = Api;