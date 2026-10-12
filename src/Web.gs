/**
 * Web.gs — pintu masuk HTTP untuk backend.
 *
 * Dua mode panggilan:
 *  - doGet  : halaman status, untuk manusia yang salah klik alamat
 *  - doPost : API JSON, dipanggil frontend
 *
 * CATATAN ARSITEKTUR PENTING
 * ----------------------------
 * Aplikasi ini TIDAK dilayani lewat HtmlService. Alasan:
 * HtmlService membungkus halaman dalam iframe tersandbox dengan asal
 * *.googleusercontent.com. Di dalam iframe itu:
 *   - Service Worker tidak berjalan  -> tidak ada PWA yang bisa diinstall
 *   - Manifest tidak dibaca          -> tidak bisa ditambahkan ke layar utama
 *   - Tidak ada mode offline
 * Itu menghapus justru alasan kenapa aplikasi ini dibangun sebagai PWA.
 *
 * Karena itu frontend dilayani dari GitHub Pages (PWA sungguhan), dan
 * skrip ini hanya jadi API. Apps Script sebagai web app mengizinkan
 * Cross-Origin (CORS), jadi panggilan dari GitHub Pages bisa masuk.
 *
 * Identitas pengguna TIDAK memakai Session.getActiveUser() — untuk
 * panggilan lintas asal itu selalu kosong. Identitas dibawa sebagai
 * token ID Google yang diverifikasi di sini.
 */

const WEB = {
  NAMA: 'Monitoring Cutting Tool API',
  VERSI: '1.0',
  // origins that may call this API. '*' means everyone, because authentication
  // is not from the origin but from the ID token in the request body.
  // If you want to tighten it, replace with a domain list.
  CORS: '*',
};

/** Only set the response headers. Don't call sendStatus after this. */
function cors_() {
  const out = ContentService.createTextOutput(JSON.stringify({ ok: true }));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

/**
 * Do GET: returns only service status, not data.
 * So if someone opens the URL by accident, they won't see spreadsheet data.
 */
function doGet(e) {
  return halamanStatus_();
}

/**
 * Do POST: JSON API.
 * Body: { token, aksi, argumen }
 */
function doPost(e) {
  let req = {};
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_(400, 'Bad request', { pesan: 'Body must be valid JSON.' });
  }

  const aksi = String(req.aksi || '');
  if (!aksi) return json_(400, 'Bad request', { pesan: 'Field "aksi" is required.' });

  // Health check doesn't need identity — used by the frontend to check connection
  if (aksi === 'ping') {
    return json_(200, 'OK', { nama: WEB.NAMA, versi: WEB.VERSI, waktu: new Date().toISOString() });
  }

  // Diagnosis juga tanpa token: kebutuhan untuk melihat apakah sheet terbaca
  // dan apakah UrlFetchApp sudah diotorisasi.
  if (aksi === 'diagnostik') {
    return json_(200, 'OK', api_diagnostik());
  }

  // The rest requires identity
  let profil;
  try {
    profil = identitasDariToken_(req.token);
  } catch (err) {
    return json_(401, 'Unauthorized', { pesan: err.message || 'Token is invalid.' });
  }

  try {
    const hasil = jalankanAksi_(aksi, req.argumen || {}, profil);
    return json_(200, 'OK', hasil);
  } catch (err) {
    return json_(500, 'Error', { pesan: String(err.message || err) });
  }
}

/** Dispatch to api_* functions. This list is the complete list of allowed actions. */
function jalankanAksi_(aksi, argumen, profil) {
  const daftar = {
    whoami: () => ({ ok: true, data: profil }),
    referensi: () => api_referensi(),
    dashboard: () => api_dashboard(),
    kartu: () => api_kartuAlat(argumen.kode),
    buatTicket: () => api_buatTicket(argumen.tiket || {}),
    daftarTiket: () => api_daftarTiket(argumen.filter || {}),
    movement: () => api_catatMovement(argumen.movement || {}),
    health: () => api_healthCheck(),
  };
  const f = daftar[aksi];
  if (!f) throw new Error('Unknown action: ' + aksi);
  return f();
}

/** JSON response with HTTP status code. */
function json_(kode, status, data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Verifikasi Google ID token -> email -> cari peran di Master User.
 * Jangan pernah menebak: kalau gagal, sebutkan tahap mana yang gagal.
 */
function identitasDariToken_(token) {
  if (!token) throw new Error('Tidak ada token yang dikirim.');

  // PENTING: memanggil UrlFetchApp untuk pertama kali setelah cakupan
  // OAuth berubah akan gagal sampai pengguna memberi otorisasi ulang.
  // Galat di sini hampir selalu berarti itu masalahnya.
  let info;
  try {
    info = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), {
      muteHttpExceptions: true,
    });
  } catch (e) {
    throw new Error('Server tidak bisa menghubungi Google untuk memverifikasi token. '
      + 'Biasanya karena script belum diotorisasi ulang setelah cakupan OAuth berubah: '
      + 'buka editor Apps Script, pilih fungsi-periksa(), lalu klik Jalankan. ('
      + String(e.message || e).slice(0, 120) + ')');
  }

  const kode = info.getResponseCode();
  if (kode !== 200) {
    throw new Error('Token ditolak Google (kode ' + kode + '). Jalankan ulang '
      + 'periksaSkope() di editor Apps Script untuk melihat otorisasinya.');
  }

  const t = JSON.parse(info.getContentText());
  if (!t.email) throw new Error('Token tidak memuat alamat email.');
  if (String(t.email_verified) === 'false') throw new Error('Email belum terverifikasi di Google.');

  if (CONFIG.CLIENT_ID && t.aud !== String(CONFIG.CLIENT_ID)) {
    throw new Error('Client ID pada token tidak cocok dengan server. '
      + 'Token dibuat untuk client_id yang lain.');
  }

  const email = String(t.email).toLowerCase();
  const sh = sh_('M_USER');
  const baris = nonempty_(rows_(sh, ['Email', 'Nama', 'Peran', 'Plant', 'Aktif (Y/N)']));
  const saya = baris.find((r) => String(r['Email']).trim().toLowerCase() === email);

  if (!saya) {
    throw new Error(email + ' belum terdaftar di Master User. '
      + 'Minta admin Gudang menambahkan email ini di sheet Master User.');
  }
  if (String(saya['Aktif (Y/N)']).trim() !== 'Y') throw new Error('Akun ' + email + ' sedang dinonaktifkan.');

  const peran = String(saya['Peran']).trim();
  if (!CONFIG.IZIN[peran]) throw new Error('Peran "' + peran + '" tidak dikenal di sistem.');

  return {
    email: email,
    nama: String(saya['Nama'] || email),
    peran: peran,
    plant: String(saya['Plant'] || ''),
    izin: CONFIG.IZIN[peran],
  };
}

/**
 * Fungsi untuk dijalankan manual dari editor Apps Script.
 * Melaporkan apakah server punya akses ke spreadsheet dan ke internet,
 * dan mengotorisasi ulang UrlFetchApp bila perlu.
 * Jalankan sekali dari editor, lalu periksa isi log eksekusi.
 */
function periksaSkope() {
  const laporan = [];
  laporan.push('Waktu: ' + new Date().toISOString());
  laporan.push('CLIENT_ID terisi: ' + (CONFIG.CLIENT_ID ? 'YA' : 'TIDAK'));

  try {
    const sh = sh_('M_USER');
    laporan.push('Buka Master User: BERHASIL (' + sh.getLastRow() + ' baris)');
    const pets = nonempty_(rows_(sh, ['Email', 'Peran', 'Aktif (Y/N)']));
    laporan.push('Pengguna terdaftar: ' + pets.length);
    pets.forEach((p) => laporan.push('  - ' + p['Email'] + ' | ' + p['Peran'] + ' | aktif=' + p['Aktif (Y/N)']));
  } catch (e) {
    laporan.push('Buka Master User: GAGAL - ' + e.message);
  }

  try {
    const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=x', { muteHttpExceptions: true });
    laporan.push('UrlFetchApp: JALAN (kode ' + r.getResponseCode() + ') - ini yang penting');
  } catch (e) {
    laporan.push('UrlFetchApp: GAGAL - ' + String(e.message || e).slice(0, 200));
    laporan.push('  -> Jalankan ulang fungsi ini untuk memberi otorisasi');
  }

  const teks = laporan.join('\n');
  Logger.log(teks);
  SpreadsheetApp.getActive();
  return teks;
}

/** Aksi diagnose; dipakai frontend saat masuk gagal. */
function api_diagnostik() {
  try {
    const sh = sh_('M_USER');
    const pets = nonempty_(rows_(sh, ['Email', 'Nama', 'Peran', 'Plant', 'Aktif (Y/N)']));
    let jaring = 'tidak diuji';
    try {
      const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=x', { muteHttpExceptions: true });
      jaring = 'jalan (kode ' + r.getResponseCode() + ')';
    } catch (e) {
      jaring = 'GAGAL: ' + String(e.message || e).slice(0, 160);
    }
    return ok_({
      clientIdTerisi: !!CONFIG.CLIENT_ID,
      clientId: CONFIG.CLIENT_ID ? String(CONFIG.CLIENT_ID).slice(0, 28) + '…' : '',
      spreadsheet: CONFIG.SPREADSHEET_ID,
      sheetTerbaca: true,
      barisMasterUser: pets.length,
      pengguna: pets.map((p) => ({ email: String(p['Email'] || '').trim(), peran: String(p['Peran'] || '').trim(), aktif: String(p['Aktif (Y/N)'] || '').trim() })),
      urlFetchApp: jaring,
    });
  } catch (e) {
    return gagal_(e.message);
  }
}

/** Status page, for humans. */
function halamanStatus_() {
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:system-ui,sans-serif;background:#fff;color:#0B2E6F;margin:0;padding:40px}' +
    'h1{font-size:22px;margin:0 0 4px}p{color:#3A5793}' +
    'code{background:#EEF3FB;padding:2px 6px;border-radius:3px;font-size:13px}' +
    '.k{margin-top:28px;padding:14px 16px;background:#EEF3FB;border-left:3px solid #1565F0;border-radius:6px}' +
    '</style></head><body>' +
    '<h1>' + WEB.NAMA + '</h1>' +
    '<p>Backend sedang jalan. Version ' + WEB.VERSI + '</p>' +
    '<div class="k">Ini pintu masuk API. Aplikasinya ada di GitHub Pages:<br>' +
    '<code>https://wahyuar0709-web.github.io/cutting-tool-pwa/</code></div>' +
    '<p style="margin-top:28px;font-size:13px;color:#7A90B8">Untuk cek status, kirim POST: ' +
    '<code>{"aksi":"ping"}</code></p></body></html>';

  return HtmlService.createHtmlOutput(html);
}