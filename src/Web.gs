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
 * Verify Google ID token -> email -> look up role in Master User.
 * Throw if verification fails. Don't guess, don't default to ADMIN.
 */
function identitasDariToken_(token) {
  if (!token) throw new Error('No token sent.');

  // Google provides token info endpoint, no extra library needed
  const info = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), {
    muteHttpExceptions: true,
  });
  if (info.getResponseCode() !== 200) {
    throw new Error('Token failed verification.');
  }
  const t = JSON.parse(info.getContentText());
  if (!t.email) throw new Error('Token has no email.');
  if (!t.email_verified || t.email_verified === 'false') {
    throw new Error('Email is not verified.');
  }
  if (t.aud !== String(CONFIG.CLIENT_ID || '')) {
    // If CLIENT_ID is not set, skip aud check to ease initial setup
    if (CONFIG.CLIENT_ID) throw new Error('Token audience mismatch.');
  }

  const email = String(t.email).toLowerCase();
  const sh = sh_('M_USER');
  const peta = header_(sh);
  const baris = nonempty_(rows_(sh, ['Email', 'Nama', 'Peran', 'Plant', 'Aktif (Y/N)']));
  const saya = baris.find((r) => String(r['Email']).trim().toLowerCase() === email);

  if (!saya) throw new Error(email + ' is not registered in Master User.');
  if (String(saya['Aktif (Y/N)']).trim() !== 'Y') throw new Error('Account is inactive.');

  const peran = String(saya['Peran']).trim();
  if (!CONFIG.IZIN[peran]) throw new Error('Unknown role: ' + peran);

  return {
    email: email,
    nama: String(saya['Nama'] || email),
    peran: peran,
    plant: String(saya['Plant'] || ''),
    izin: CONFIG.IZIN[peran],
  };
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