/**
 * Repo.gs — satu-satunya tempat yang boleh menulis ke spreadsheet.
 *
 * Aturan S1: hanya kolom INPUT yang ditulis. Daftar putihnya ada di
 * CONFIG.INPUT_COLUMNS. Kolom rumus tidak boleh disentuh, termasuk dengan
 * string kosong — itulah yang sempat menghapus kolom Cek.
 */

/** Susun range "A12:L12" dari daftar nama kolom input. */
function rangeDari_(sheet, namaKolom, baris) {
  const peta = header_(sheet);
  const idx = namaKolom.map((n) => peta[n]).filter(Boolean);
  if (idx.length === 0) throw new Error('Tidak ada kolom input yang cocok di ' + sheet.getName());
  const min = Math.min.apply(null, idx);
  const maks = Math.max.apply(null, idx);
  // kolom input tidak boleh bolong; kalau bolong, tulis per kolom
  const bolong = maks - min + 1 !== idx.length;
  if (bolong) return null;
  return { min: min, maks: maks, baris: baris, seukuran: true };
}

/**
 * Tulis satu baris pada kolom input saja.
 * Kalau kolom inputnya tidak bersebelahan, tulis per sel.
 */
function tulisInput_(sheet, baris, objek) {
  const nama = CONFIG.INPUT_COLUMNS[sheet.getName()];
  if (!nama) throw new Error('Sheet ' + sheet.getName() + ' tidak ada daftar kolom input di CONFIG.');
  const peta = header_(sheet);
  const nilai = nama.map((n) => {
    const v = obj[n];
    return v === undefined || v === null ? '' : v;
  });

  const rentang = rangeDari_(sheet, nama, baris);
  if (rentang) {
    sheet.getRange(rentang.baris, rentang.min, 1, rentang.maks - rentang.min + 1).setValues([nilai]);
  } else {
    nama.forEach((n, i) => {
      const c = peta[n];
      if (c) sheet.getRange(baris, c).setValue(nilai[i]);
    });
  }
}

/**
 * Catat satu perpindahan tool.
 * Validasi dulu; kalau gagal tidak ada yang ditulis sama sekali.
 */
function catatMovement_(m, pemesan) {
  return withLock_(function () {
    const ctx = bacaKonteks_();
    const v = validasiMovement_(m, ctx);

    //Aturan S2: pastikan ruang tersedia sebelum menulis
    const sh = sh_('MOV');
    const peta = header_(sh);
    const baris = barisKosong_(sh, ['Unit_ID (input)']);
    if (sh.getMaxRows() - baris < 2) {
      throw new Error('Tool Movements hampir penuh. Jalankan extendSheet() sebelum menambah data.');
    }

    if (!v.valid) {
      return { ok: false, pesan: 'Data belum disimpan.', masalah: v.masalah, ditulis: false };
    }

    tulisInput_(sh, baris, {
      'Tanggal': m.tanggal || tgl_(),
      'Date_Source': m.dateSource || 'ACTUAL',
      'Unit_ID (input)': m.unitId,
      'Activity': m.activity,
      'Machine_ID': m.machineId || '',
      'Vendor_ID': m.vendorId || '',
      'Order_ID': m.orderId || '',
      'PIC': m.pic || (pemesan ? pemesan.nama : ''),
      'Reference_ID (tiket)': m.ref || '',
      'Source': 'PWA',
      'Remark': m.remark || '',
    });

    return {
      ok: true,
      pesan: 'Tercatat.',
      ditulis: true,
      baris: baris,
      unitId: m.unitId,
      statusSebelum: v.statusSebelum,
      statusSekarang: v.toStatus,
    };
  });
}

/**
 * Daftarkan pengajuan asah dari operator.
 * Operator melaporkan apa yang dia lihat; pemilihan unit tetap urusan gudang.
 */
function buatTicket_(t, pemesan) {
  return withLock_(function () {
    const sh = sh_('REQ');
    const peta = header_(sh);

    const toolCode = String(t.toolCode || '').trim();
    if (!toolCode) return { ok: false, pesan: 'Pilih alat dulu.', masalah: ['Tool_Code belum diisi.'], ditulis: false };

    const tools = nonempty_(rows_(sh_('M_TOOL'), ['Tool_Code', 'Tool_Name', 'Tool_Type', 'Max_Regrind', 'Active (Y/N)']));
    const tool = tools.find((x) => String(x['Tool_Code']).trim() === toolCode);
    if (!tool) return { ok: false, pesan: 'Alat tidak dikenal.', masalah: ['Alat ' + toolCode + ' tidak ada di Master Tool.'], ditulis: false };
    if (String(tool['Active (Y/N)']).trim() === 'N') {
      return { ok: false, pesan: 'Alat tidak aktif.', masalah: [toolCode + ' berstatus nonaktif.'], ditulis: false };
    }

    const qty = Number(t.qty || 0);
    if (!(qty > 0)) return { ok: false, pesan: 'Jumlah unit belum diisi.', masalah: ['Jumlah harus lebih dari 0.'], ditulis: false };

    if (t.machineId) {
      const mesin = nonempty_(rows_(sh_('M_MACHINE'), ['Machine_ID', 'Cek']));
      if (!mesin.some((x) => String(x['Machine_ID']).trim() === String(t.machineId).trim())) {
        return { ok: false, pesan: 'Mesin tidak dikenal.', masalah: ['Mesin ' + t.machineId + ' tidak ada di Master Machine.'], ditulis: false };
      }
    }

    const baris = barisKosong_(sh, ['Ticket_ID']);
    if (sh.getMaxRows() - baris < 2) {
      throw new Error('Regrind Requests hampir penuh. Jalankan extendSheet() lebih dulu.');
    }

    const id = idBerikut_(sh, 'Ticket_ID', 'TRG');
    tulisInput_(sh, baris, {
      'Ticket_ID': id,
      'Tanggal': tgl_(),
      'Operator': pemesan ? pemesan.nama : '',
      'Machine_ID': t.machineId || '',
      'Tool_Code': toolCode,
      'Qty': qty,
      'Kondisi': t.kondisi || 'TUMPUL',
      'Aktual_Pemakaian': t.pemakaian || '',
      'Catatan / Ident': t.catatan || '',
      'Foto_URL': t.fotoUrl || '',
    });

    return { ok: true, pesan: 'Pengajuan terkirim · ' + id, ditulis: true, baris: baris, ticketId: id, toolCode: toolCode };
  });
}