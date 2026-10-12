/* ==========================================================================
   api.js — jembatan ke backend Apps Script.

   Jalur:
   1. Pratinjau : web/data/pratinjau.json (data nyata, hanya baca)
   2. Langsung (editor Apps Script): fungsi api_* dipanggil langsung
   3. Dari browser (GitHub Pages)  : fetch POST ke KONFIGURASI.API_URL, bawa token Google

   Semua fungsi mengembalikan {ok, data, pesan, detail}. Tidak ada exception
   yang dibiarkan sampai ke layar.
   ========================================================================== */

const Api = (() => {
  let cachePratinjau = null;

  async function dariPratinjau(aksi, argumen) {
    try {
      if (!cachePratinjau) {
        const r = await fetch('data/pratinjau.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('berkas pratinjau tidak terbaca (' + r.status + ')');
        cachePratinjau = await r.json();
      }
      const d = cachePratinjau;
      switch (aksi) {
        case 'whoami':      return { ok: true, data: d.profil };
        case 'referensi':   return { ok: true, data: d.referensi };
        case 'dashboard':   return { ok: true, data: d.dashboard };
        case 'daftarTiket': return { ok: true, data: d.daftarTiket || [] };
        case 'health':      return { ok: true, data: d.healthCheck };
        case 'kartu': {
          // PENTING: pakai kode yang diminta. Dulu berkas ini hanya berisi satu
          // kartu, sehingga mengetik kode lain tetap menampilkan kartu yang sama
          // — judulnya jadi tercampur (mis. "LEU-CT-11 · Saw blade LEITZ").
          const kode = String((argumen && argumen.kode) || '').trim().toUpperCase();
          const kartu = d.kartu || {};
          const semua = Object.keys(kartu);
          if (!kode) {
            return { ok: false, pesan: 'Kode alat belum diisi.', detail: [] };
          }
          if (kartu[kode]) return { ok: true, data: kartu[kode] };
          // toleransi kecil: pengguna mengetik "lei-sb-01" atau "LEI SB-01"
          const mirip = semua.find((k) => k.toUpperCase().replace(/[^A-Z0-9]/g, '') === kode.replace(/[^A-Z0-9]/g, ''));
          if (mirip) return { ok: true, data: kartu[mirip] };
          return { ok: false, pesan: 'Alat ' + kode + ' belum punya unit terdaftar.', detail: [] };
        }
        default:
          return { ok: false, pesan: 'Mode pratinjau hanya bisa dibaca.', detail: [] };
      }
    } catch (e) {
      return { ok: false, pesan: 'Pratinjau tidak bisa dimuat: ' + (e.message || e), detail: [] };
    }
  }

  /**
   * Frontend sengaja TIDAK dilayani HtmlService: iframe sandbox akan
   * mematikan service worker, manifest, dan mode offline — tiga alasan
   * kenapa aplikasi ini dibangun sebagai PWA. Jadi tidak ada jalur
   * google.script.run di sini; dari browser selalu lewat HTTP.
   */

  async function dariHttp(aksi, argumen) {
    let token;
    try {
      token = await Auth.tokenAktif();
    } catch (e) {
      return { ok: false, pesan: 'Belum masuk. Masuk dengan akun Google dulu.', detail: [], perluMasuk: true };
    }
    if (!token) return { ok: false, pesan: 'Belum masuk.', detail: [], perluMasuk: true };

    try {
      const r = await fetch(KONFIGURASI.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token: token, aksi: aksi, argumen: argumen || {} }),
      });
      const teks = await r.text();
      let json;
      try { json = JSON.parse(teks); } catch { return { ok: false, pesan: 'Respons server tidak dimengerti.', detail: [] }; }
      return normalisasi(json);
    } catch (e) {
      return { ok: false, pesan: 'Tidak bisa menghubungi backend: ' + (e.message || e), detail: [] };
    }
  }

  function normalisasi(r) {
    if (!r || typeof r !== 'object') return { ok: false, pesan: 'Respons server tidak dimengerti.', detail: [] };
    return {
      ok: !!r.ok,
      data: r.data ?? null,
      pesan: r.pesan || r.info || '',
      detail: Array.isArray(r.detail) ? r.detail : (r.masalah || []),
      perluMasuk: !!r.perluMasuk,
    };
  }

async function panggil(aksi, argumen) {
    // Inside the Apps Script editor itself there are the api_* functions.
    if (typeof api_whoami === 'function') {
      try {
        const pemanggil = {
          whoami: () => api_whoami(), referensi: () => api_referensi(),
          dashboard: () => api_dashboard(), kartu: (a) => api_kartuAlat(a.kode),
          buatTicket: (a) => api_buatTicket(a.tiket || {}), daftarTiket: (a) => api_daftarTiket(a.filter || {}),
          movement: (a) => api_catatMovement(a.movement || {}), health: () => api_healthCheck(),
        }[aksi];
        return normalisasi(await pemanggil(argumen || {}));
      } catch (e) {
        return { ok: false, pesan: String(e.message || e), detail: [] };
      }
    }
    if (Auth.bisaMasuk() || Auth.sudahMasuk) return dariHttp(aksi, argumen);
    return dariPratinjau(aksi);
  }

  /** Cek apakah backend bisa dihubungi, tanpa perlu token. */
  async function periksaServer() {
    if (!KONFIGURASI.API_URL) return { ok: false, pesan: 'API_URL belum diisi.' };
    try {
      const r = await fetch(KONFIGURASI.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ aksi: 'ping' }),
      });
      const j = JSON.parse(await r.text());
      return { ok: !!j.nama, data: j };
    } catch (e) {
      return { ok: false, pesan: 'Backend tidak terjangkau: ' + (e.message || e) };
    }
  }

  return {
    periksaServer,
    whoami: () => panggil('whoami'),
    referensi: () => panggil('referensi'),
    dashboard: () => panggil('dashboard'),
    kartuAlat: (kode) => panggil('kartu', { kode }),
    buatTicket: (t) => panggil('buatTicket', { tiket: t }),
    daftarTiket: (f) => panggil('daftarTiket', { filter: f }),
    catatMovement: (m) => panggil('movement', { movement: m }),
    healthCheck: () => panggil('health'),
  };
})();

window.Api = Api;