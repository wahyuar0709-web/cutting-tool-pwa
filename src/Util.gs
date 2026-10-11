/**
 * Util.gs — pembantu umum: sheet, header, kolom, tanggal, ID, locking.
 */

/** @return {GoogleAppsScript.Spreadsheet.Spreadsheet} */
function ss_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Ambil sheet berdasarkan nama konfigurasi.
 * @param {string} key kunci di CONFIG.SHEETS
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function sh_(key) {
  const nama = CONFIG.SHEETS[key] || key;
  const sh = ss_().getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak ditemukan');
  return sh;
}

/** Angka 1 -> "A" */
function huruf_(n) {
  let x = '';
  while (n > 0) { const m = (n - 1) % 26; x = String.fromCharCode(65 + m) + x; n = Math.floor((n - m - 1) / 26); }
  return x;
}

/**
 * Peta header kolom: nama -> indeks 1-based.
 *values.get MELOMPATI baris kosong, jadi jangan pernah meng indeks baris tetap.
 */
function header_(sheet) {
  const cache = CacheService.getScriptCache();
  const kunci = 'hdr:' + sheet.getSheetId();
  constcached = cache.get(kunci);
  if (cached) return JSON.parse(cached);
  const baris = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
  const peta = {};
  baris.forEach((h, i) => { const n = String(h || '').trim(); if (n) peta[n] = i + 1; });
  cache.put(kunci, JSON.stringify(peta), CONFIG.CACHE_TTL);
  return peta;
}

/**
 * Jadikan objek baris (nilai -> header) yang hanya berisi kolom yang diminta.
 * values.get tidak boleh di indeks langsung: baris kosong dilewati.
 */
function rows_(sheet, kolomDiminta) {
  const jml = sheet.getLastRow();
  if (jml < 1) return [];
  const nilai = sheet.getRange(1, 1, jml, sheet.getLastColumn()).getValues();
  const peta = header_(sheet);
  const namaKolom = kolomDiminta && kolomDiminta.length
    ? kolomDiminta
    : Object.keys(peta);
  return nilai.map((row, i) => {
    const o = { _baris: i + 1 };
    namaKolom.forEach((nama) => {
      const idx = peta[nama];
      if (idx) o[nama] = row[idx - 1];
    });
    return o;
  });
}

/** Baris pertama yang seluruh kolom kunci kosong. */
function barisKosong_(sheet, kolom) {
  const peta = header_(sheet);
  const jml = sheet.getLastRow();
  const nilai = sheet.getRange(1, 1, jml, sheet.getLastColumn()).getValues();
  for (let i = 1; i < nilai.length; i++) {
    const kosong = kolom.every((n) => !String(nilai[i][peta[n] - 1] ?? '').trim());
    if (kosong) return i + 1;
  }
  return jml + 1;
}

/**
 * Jalankan fn di bawah kunci eksklusif. Semua tulis WAJIB lewat sini.
 * Tanpa ini, dua admin bisa menimpa baris yang sama.
 */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** Tanggal hari ini di zona waktu pabrik, sebagai Date. */
function hariIni_() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  return new Date(f.format(new Date()) + 'T00:00:00');
}

/** Tanggal sebagai string YYYY-MM-DD (bukan objek Date — Sheet akan simpan sebagai teks). */
function tgl_(d) {
  const x = d || hariIni_();
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(x);
}

/** ID berurutan berformat PREFIX-YYYY-NNNN, dihitung dari isi sheet. */
function idBerikut_(sheet, kolom, prefix) {
  const peta = header_(sheet);
  const c = peta[kolom];
  if (!c) throw new Error('Kolom "' + kolom + '" tidak ada di sheet ' + sheet.getName());
  const jml = sheet.getLastRow();
  const nilai = sheet.getRange(2, c, Math.max(jml - 1, 1), 1).getValues();
  const tahun = tgl_().slice(0, 4);
  const awalan = prefix + '-' + tahun + '-';
  let maks = 0;
  nilai.forEach((r) => {
    const v = String(r[0] || '');
    if (v.indexOf(awalan) === 0) {
      const n = parseInt(v.slice(awalan.length), 10);
      if (!isNaN(n) && n > maks) maks = n;
    }
  });
  return awalan + String(maks + 1).padStart(4, '0');
}

/** Bungkus hasil supaya klien tidak perlu try/catch. */
function ok_(data, info) {
  return { ok: true, data: data || null, info: info || '' };
}
function gagal_(pesan, detail) {
  return { ok: false, pesan: pesan, detail: detail || [] };
}

/** Buang baris kosong di ujung array (values.get tidakrepresentationkan). */
function nonempty_(rows) {
  return rows.filter((r) => r._baris && Object.keys(r).some((k) => k !== '_baris' && String(r[k] ?? '').trim() !== ''));
}