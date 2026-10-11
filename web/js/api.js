/* ==========================================================================
   api.js — jembatan ke backend Apps Script.
   Semua fungsi mengembalikan {ok, data, pesan, detail}. Tidak ada throw
   yang sampai ke layar — gagal selalu tampil sebagai pesan.
   ========================================================================== */

const Api = (() => {
  const SEDANG = 'sedang';
  let devMode = false;

  /** Bungkus pemanggilan google.script.run menjadi Promise. */
  function panggil(nama, ...args) {
    return new Promise((res) => {
      if (devMode || typeof google === 'undefined' || !google.script?.run) {
        res({ ok: false, pesan: 'Belum terhubung ke server. Jalankan dari Apps Script Web App.', detail: [] });
        return;
      }
      google.script.run
        .withSuccessHandler((r) => res(normalisasi(r)))
        .withFailureHandler((e) => res({ ok: false, pesan: String(e?.message || e || 'Gagal menghubungi server.'), detail: [] }))[nama](...args);
    });
  }

  function normalisasi(r) {
    if (!r || typeof r !== 'object') return { ok: false, pesan: 'Respons server tidak dimengerti.', detail: [] };
    return {
      ok: !!r.ok,
      data: r.data ?? null,
      pesan: r.pesan || (r.info || ''),
      detail: Array.isArray(r.detail) ? r.detail : (r.masalah || []),
    };
  }

  return {
    aktifkanModeUji(v) { devMode = !!v; },
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