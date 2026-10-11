/**
 * Main.gs — pintu masuk yang dipanggil frontend lewat google.script.run.
 *
 * Semua fungsi di sini punya awalan api_ dan SELALU mengembalikan
 * { ok, data, pesan, detail } — tidak pernah melempar error ke klien,
 * supaya frontend tidak perlu try/catch berlapis.
 */

function api_whoami() {
  try {
    return ok_(profil_());
  } catch (e) {
    return gagal_(e.message);
  }
}

// ---------------------------------------------------------------- referensi
function api_referensi() {
  try {
    butuhIzin_('stok');
    return ok_({
      tools: nonempty_(rows_(sh_('M_TOOL'), ['Tool_Code', 'Tool_Name', 'Brand', 'Tool_Type', 'Specification', 'Max_Regrind', 'Default_Vendor_ID', 'Active (Y/N)']))
        .map((r) => ({ kode: String(r['Tool_Code']).trim(), nama: String(r['Tool_Name']).trim(), tipe: String(r['Tool_Type']).trim(), maks: Number(r['Max_Regrind']) || 0 })),
      machines: nonempty_(rows_(sh_('M_MACHINE'), ['Machine_ID', 'Machine_Name']))
        .map((r) => ({ id: String(r['Machine_ID']).trim(), nama: String(r['Machine_Name']).trim() })),
      vendors: nonempty_(rows_(sh_('M_VENDOR'), ['Vendor_ID', 'Vendor_Name', 'Aktif (Y/N)', 'SLA_Hari']))
        .map((r) => ({ id: String(r['Vendor_ID']).trim(), nama: String(r['Vendor_Name']).trim(), aktif: String(r['Aktif (Y/N)']).trim() === 'Y', sla: Number(r['SLA_Hari']) || 0 })),
      kondisi: ['TUMPUL', 'TAPIS', 'PATAH', 'KARAT'],
    });
  } catch (e) {
    return gagal_(e.message);
  }
}

// ---------------------------------------------------------------- operator
function api_buatTicket(t) {
  try {
    const p = butuhIzin_('tiket.buat');
    const r = buatTicket_(t || {}, p);
    return r.ok ? ok_({ ticketId: r.ticketId, pesan: r.pesan }) : gagal_(r.pesan, r.masalah);
  } catch (e) {
    return gagal_(e.message);
  }
}

function api_kartuAlat(toolCode) {
  try {
    butuhIzin_('kartu');
    const kode = String(toolCode || '').trim();
    if (!kode) return gagal_('Kode alat belum diisi.');

    const units = nonempty_(rows_(sh_('M_TOOL_UNIT'), ['Unit_ID', 'Tool_Code', 'Ident_Nr', 'Status', 'Life_No', 'Regrind_Count', 'Max_Regrind', 'Sisa_Regrind', 'Flag_Scrap', 'Hari_di_Status']));
    const milik = units.filter((u) => String(u['Tool_Code']).trim() === kode);
    if (!milik.length) return gagal_('Alat ' + kode + ' belum punya unit terdaftar.');

    const shUS = sh_('UNIT_STATUS');
    const peta = header_(shUS);
    const petaStatus = peta['Status'] || -1;
    const petaLife = peta['Life_No'] || -1;
    const petaReg = peta['Regrind_Count'] || -1;
    const petaMaks = peta['Max_Regrind'] || -1;
    const petaSisa = peta['Sisa_Regrind'] || -1;
    const petaFlag = peta['Flag_Scrap'] || -1;
    const jml = shUS.getLastRow();
    const data = jml > 1 ? shUS.getRange(2, 1, jml - 1, shUS.getLastColumn()).getValues() : [];

    const isi = milik.map((u) => {
      const id = String(u['Unit_ID']).trim();
      const baris = data.find((r) => String(r[peta['Unit_ID'] - 1] || '').trim() === id);
      const ambil = (p) => (baris && p > 0 ? baris[p - 1] : '');
      return {
        unitId: id,
        ident: String(u['Ident_Nr'] || '').trim(),
        status: String(ambil(petaStatus)).trim(),
        life: Number(ambil(petaLife)) || 0,
        regrind: Number(ambil(petaReg)) || 0,
        maks: Number(ambil(petaMaks)) || 0,
        sisa: ambil(petaSisa) === '' ? null : Number(ambil(petaSisa)),
        flag: String(ambil(petaFlag)).trim(),
      };
    });

    return ok_({
      toolCode: kode,
      total: isi.length,
      maks: Math.max.apply(null, isi.map((u) => u.maks || 0)),
      perStatus: isi.reduce((a, u) => { a[u.status || '?'] = (a[u.status || '?'] || 0) + 1; return a; }, {}),
      units: isi,
    });
  } catch (e) {
    return gagal_(e.message);
  }
}

// ---------------------------------------------------------------- admin
function api_catatMovement(m) {
  try {
    const p = butuhIzin_('movement');
    const r = catatMovement_(m || {}, p);
    return r.ok ? ok_(r) : gagal_(r.pesan, r.masalah);
  } catch (e) {
    return gagal_(e.message);
  }
}

function api_daftarTiket(filter) {
  try {
    butuhIzin_('tiket.lihat');
    const f = filter || {};
    const sh = sh_('REQ');
    let data = nonempty_(rows_(sh, ['Ticket_ID', 'Tanggal', 'Operator', 'Machine_ID', 'Tool_Code', 'Qty', 'Kondisi', 'Catatan / Ident', 'Status_Verifikasi', 'Unit_Final', 'Status_Proses', 'Q']));
    if (f.toolCode) data = data.filter((r) => String(r['Tool_Code']).trim() === String(f.toolCode).trim());
    if (f.status) data = data.filter((r) => String(r['Status_Verifikasi'] || '').trim() === String(f.status).trim());
    data.sort((a, b) => String(b['Ticket_ID']).localeCompare(String(a['Ticket_ID'])));
    return ok_(data.slice(0, Number(f.limit) || 100));
  } catch (e) {
    return gagal_(e.message);
  }
}

// ---------------------------------------------------------------- semua peran
function api_dashboard() {
  try {
    butuhIzin_('dashboard');
    const sh = sh_('DASHBOARD');
    const jml = Math.min(sh.getLastRow(), 30);
    const isi = sh.getRange(1, 1, jml, 8).getValues();
    const teks = isi.map((r) => r.map((c) => String(c === null || c === undefined ? '' : c).trim()));

    // Cari baris berdasarkan LABEL, bukan nomor baris tetap.
    const cariBaris = (label) => teks.findIndex((r) => r.some((c) => c === label));
    const nilaiDiBawah = (label, kolom) => {
      const i = cariBaris(label);
      if (i < 0) return null;
      const k = teks[i].indexOf(label);
      for (let b = i; b <= i + 2; b++) {
        const v = (teks[b] || [])[k];
        if (v !== undefined && v !== '' && !isNaN(Number(v))) return Number(v);
      }
      return null;
    };

    // TOTAL ERROR dan TOTAL PERINGATAN TIDAK ada di DASHBOARD —
    // keduanya berada di sheet Master Data Audit. Membacanya dari DASHBOARD
    // selalu menghasilkan null, dan galat yang tidak terlihat adalah galat
    // yang paling berbahaya.
    let totalError = null, totalPeringatan = null;
    try {
      const shA = sh_('MASTER_DATA_AUDIT');
      const jmlA = Math.min(shA.getLastRow(), 40);
      const barisA = shA.getRange(1, 1, jmlA, 6).getValues().map((r) => r.map((c) => String(c === null || c === undefined ? '' : c).trim()));
      const cari = (awal) => barisA.find((r) => r.some((c) => c.indexOf(awal) === 0));
      const ambil = (awal) => {
        const r = cari(awal);
        return r ? (Number(r[3]) || 0) : null;
      };
      totalError = ambil('TOTAL ERROR');
      totalPeringatan = ambil('TOTAL PERINGATAN');
    } catch (e) { /* sheet belum ada */ }

    return ok_({
      badge: (cariBaris('Kualitas data:') >= 0 ? (teks[cariBaris('Kualitas data:')].find((c) => /BERSIH|ERROR/.test(c)) || '') : ''),
      totalUnit: nilaiDiBawah('Total Unit Aktif', 0),
      siap: nilaiDiBawah('Siap Pakai', 0),
      dipakai: nilaiDiBawah('Dipakai di Mesin', 0),
      menunggu: nilaiDiBawah('Menunggu Asah', 0),
      diVendor: nilaiDiBawah('Di Vendor (Diasah)', 0),
      perluCek: nilaiDiBawah('Perlu Cek', 0),
      habis: nilaiDiBawah('Item HABIS', 0),
      kritis: nilaiDiBawah('Item KRITIS', 0),
      peringatan: nilaiDiBawah('Item WASPADA', 0),
      wajibScrap: nilaiDiBawah('Unit WAJIB Evaluasi Scrap', 0),
      hampirMaks: nilaiDiBawah('Unit Hampir Maks Regrind', 0),
      totalError: totalError,
      totalPeringatan: totalPeringatan,
    });
  } catch (e) {
    return gagal_(e.message);
  }
}

function api_healthCheck() {
  try { return ok_(healthCheck_()); } catch (e) { return gagal_(e.message); }
}