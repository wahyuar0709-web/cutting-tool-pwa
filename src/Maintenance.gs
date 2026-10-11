/**
 * Maintenance.gs — pemeriksaan dan perbaikan berkala.
 * Dijalankan manual, atau dijadwalkan setiap 6 jam.
 */

/**
 * Periksa kesehatan spreadsheet: sel error, kapasitas, rujukan silang,
 * badge dashboard, aturan scrap, dan konsistensi stok.
 * @return {Object} ringkasan + daftar masalah
 */
function healthCheck_() {
  const masalah = [];
  const add = (m) => { masalah.push(m); };

  const ss = ss_();
  const all = ss.getSheets();

  // ---- 1. nilai error di seluruh workbook ----
  const polaError = /^#(VALUE|REF|NAME|N\/A|NUM|DIV\/0)/;
  const rincianError = [];
  all.forEach((sh) => {
    if (/^Legacy/.test(sh.getName())) return;
    const jml = sh.getLastRow();
    if (jml < 1) return;
    const kolom = sh.getLastColumn();
    const rng = sh.getRange(1, 1, Math.min(jml, 7000), Math.min(kolom, 35));
    const v = rng.getValues();
    let n = 0, contoh = [];
    v.forEach((row, i) => row.forEach((c, j) => {
      const s = String(c === null || c === undefined ? '' : c);
      if (polaError.test(s)) { n++; if (contoh.length < 3) contoh.push(huruf_(j + 1) + (i + 1)); }
    }));
    if (n) { rincianError.push(sh.getName() + ' ' + n + ' sel (' + contoh.join(',') + ')'); add('Sel error di ' + sh.getName() + ': ' + n); }
  });

  // ---- 2. kapasitas ----
  const kapasitas = [];
  ['M_TOOL', 'M_TOOL_UNIT', 'MOV', 'ORD', 'REQ'].forEach((k) => {
    const sh = sh_(k);
    const isi = barisKosong_(sh, ['A']) - 1;
    const sisa = sh.getMaxRows() - isi;
    kapasitas.push({ sheet: CONFIG.SHEETS[k], terisi: isi, grid: sh.getMaxRows(), sisa: sisa });
    if (sisa < CONFIG.MIN_ROW_FREE) add(CONFIG.SHEETS[k] + ' tinggal ' + sisa + ' baris kosong — jalankan extendSheet()');
  });

  // ---- 3. badge dashboard ----
  let badge = '';
  try {
    const sh = sh_('DASHBOARD');
    const isi = sh.getRange(1, 1, Math.min(sh.getLastRow(), 20), 8).getValues().map((r) => r.map(String));
    const baris = isi.find((r) => r.some((c) => /BERSIH|ERROR/.test(c)));
    if (baris) badge = baris.find((c) => /BERSIH|ERROR/.test(c)) || '';
  } catch (e) { /* dashboard belum ada */ }
  if (badge && !/BERSIH/.test(badge)) add('Dashboard: ' + badge);

  // ---- 4. aturan scrap ----
  let scrap = { total: 0, tanpaMaks: 0, negatif: 0 };
  try {
    const sh = sh_('UNIT_STATUS');
    const peta = header_(sh);
    const data = nonempty_(rows_(sh, ['Unit_ID', 'Max_Regrind', 'Sisa_Regrind', 'Flag_Scrap']));
    scrap.total = data.length;
    scrap.tanpaMaks = data.filter((r) => !(Number(r['Max_Regrind']) > 0)).length;
    scrap.negatif = data.filter((r) => Number(r['Sisa_Regrind']) < 0).length;
    if (scrap.tanpaMaks > 0) add(scrap.tanpaMaks + ' unit tanpa Max_Regrind — aturan scrap tidak berlaku');
    if (scrap.negatif > 0) add(scrap.negatif + ' unit dengan Sisa_Regrind negatif');
  } catch (e) { /* belum ada data */ }

  return {
   checked: new Date().toISOString(),
    sehat: masalah.length === 0,
    masalah: masalah,
    ringkasan: { selError: rincianError, badge: badge, kapasitas: kapasitas, scrap: scrap },
  };
}

/**
 * Perbesar sheet dan isi kolom rumusnya.
 *
 * PERINGATAN: hanya menuai baris kosong. Tidak pernah menyisipkan baris di
 * tengah, karena itu menggeser rujukan antar-sheet secara tidak terduga.
 * Grid diperbesar lewat updateSheetProperties; rumus disalin dengan
 * copyPaste PASTE_FORMULA yang menjaga rujukan relatif.
 *
 * @param {string} key kunci di CONFIG.SHEETS
 * @param {number} sampai baris tujuan
 * @param {number} dariKol kolom formula mulai (1-based)
 * @param {number} sampaiKol kolom formula akhir
 * @param {number} acuan baris yang jadi pola (default: baris data terakhir)
 */
function extendSheet_(key, sampai, dariKol, sampaiKol, acuan) {
  return withLock_(function () {
    const sh = sh_(key);
    if (sampai <= sh.getMaxRows()) return { ok: true, pesan: 'Sudah cukup besar.' };

    if (acuan) {
      // salin rumus dari baris acuan ke baris baru — offset relatif dijaga Sheets
      sh.getRange(acuan, dariKol, 1, sampaiKol - dariKol + 1)
        .copyTo(sh.getRange(sh.getMaxRows(), dariKol, sampai - sh.getMaxRows(), sampaiKol - dariKol + 1), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
    }
    sh.insertRowsAfter(sh.getMaxRows(), sampai - sh.getMaxRows());
    sh.clearRows(sh.getMaxRows() - (sampai - sh.getMaxRows()), sampai - sh.getMaxRows());
    return { ok: true, pesan: sh.getName() + ' diperbesar ke ' + sh.getMaxRows() + ' baris.' };
  });
}

/** Jalankan berkala. */
function jalankanHealthCheck() {
  const r = healthCheck_();
  if (r.sehat) return 'SEHAT';
  return 'MASALAH:\n- ' + r.masalah.join('\n- ');
}