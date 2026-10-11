/**
 * Validate.gs — mesin validasi.
 *
 * Meniru rantai aturan pada kolom `Cek` di sheet `Tool Movements`.
 * TUJUHNYA: baris cacat tidak boleh sampai ke spreadsheet.
 *
 * Prinsip:
 *  - validasi di server adalah PENJAMIN, validasi di klien hanya Arenas
 *  - kalau gagal, kembalikan daftar masalah dan jangan tulis apa pun
 *  - pesan ditulis untuk orang yang membacanya, bukan untuk mesin
 */

/**
 * Validasi satu perpindahan tool.
 * @param {Object} m {unitId, activity, tanggal, dateSource, machineId, vendorId, orderId, pic, remark}
 * @param {Object} ctx konteks yang sudah dibaca pemanggil (biar tidak baca sheet berulang)
 * @return {{valid:boolean, masalah:string[], statusSebelum:string, toStatus:string}}
 */
function validasiMovement_(m, ctx) {
  const masalah = [];
  const put = (s) => masalah.push(s);
  const kosong = (v) => !String(v ?? '').trim();

  // ---- 1. unit terdaftar ----
  const unit = ctx.units.find((u) => String(u['Unit_ID']).trim() === String(m.unitId || '').trim());
  if (!unit) { put('Unit "' + (m.unitId || '(kosong)') + '" belum terdaftar di Master Tool Unit.'); return selesai(masalah); }
  const unitId = String(unit['Unit_ID']).trim();

  // ---- 2. activity dikenal ----
  const act = ctx.activities.find((a) => String(a['Activity']).trim() === String(m.activity || '').trim());
  if (!act) { put('Jenis kegiatan "' + (m.activity || '(kosong)') + '" tidak dikenal.'); return selesai(masalah); }

  // ---- 3. PIC ----
  if (kosong(m.pic)) put('PIC belum diisi.');

  // ---- 4. Date_Source ----
  if (kosong(m.dateSource)) put('Sumber tanggal belum diisi.');

  // ---- 5. tanggal ada (kecuali UNKNOWN) ----
  if (kosong(m.tanggal) && String(m.dateSource).trim() !== 'UNKNOWN') {
    put('Isi tanggal, atau tandai sumber tanggal sebagai UNKNOWN.');
  }

  // ---- status sebelum & sesudah ----
  const evt = ctx.movements.filter((e) => String(e['Unit_ID (input)']).trim() === unitId);
  const urut = evt.slice().sort((a, b) => (a['Tanggal'] < b['Tanggal'] ? -1 : a['Tanggal'] > b['Tanggal'] ? 1 : (a._baris || 0) - (b._baris || 0)));
  const terakhir = urut[urut.length - 1];
  const statusSebelum = terakhir ? String(terakhir['To_Status'] || '').trim() : String(unit['Opening_Status'] || '').trim();
  const toStatus = String(act['To_Status'] || '').trim();

  // ---- 6. transisi valid ----
  const from1 = String(act['From_1'] || '').trim();
  const from2 = String(act['From_2'] || '').trim();
  if (from1 !== 'ANY' && statusSebelum !== from1 && statusSebelum !== from2) {
    put('Tidak bisa dari "' + statusSebelum + '" ke "' + String(act['Activity']).trim() + '". Status yang boleh: ' + (from1 || from2) + '.');
  }

  // ---- 7 & 8. mesin ----
  const butuhMesin = String(act['Need_Machine']).trim() === 'Y';
  if (butuhMesin && kosong(m.machineId)) {
    put('Pilih mesin untuk kegiatan ini.');
  }
  if (!kosong(m.machineId) && !ctx.machines.some((x) => String(x['Machine_ID']).trim() === String(m.machineId).trim())) {
    put('Mesin "' + m.machineId + '" tidak terdaftar di Master Machine.');
  }

  // ---- 9 & 10. vendor ----
  const butuhVendor = String(act['Need_Vendor']).trim() === 'Y';
  if (butuhVendor && kosong(m.vendorId)) put('Pilih vendor.');
  if (!kosong(m.vendorId) && !ctx.vendors.some((v) => String(v['Vendor_ID']).trim() === String(m.vendorId).trim())) {
    put('Vendor "' + m.vendorId + '" tidak terdaftar di Master Vendor.');
  }

  // ---- 11, 12 & 13. order ----
  const butuhOrder = String(act['Need_Order']).trim() === 'Y';
  if (butuhOrder && kosong(m.orderId)) put('Buat order vendor lebih dulu.');
  let order = null;
  if (!kosong(m.orderId)) {
    order = ctx.orders.find((o) => String(o['Order_ID']).trim() === String(m.orderId).trim());
    if (!order) put('Order "' + m.orderId + '" tidak ditemukan di Regrind Orders.');
    else if (!kosong(m.vendorId) && String(order['Vendor_ID']).trim() !== String(m.vendorId).trim()) {
      put('Order ' + m.orderId + ' milik vendor ' + String(order['Vendor_ID']).trim() + ', bukan ' + String(m.vendorId).trim() + '.');
    }
  }

  // ---- 14. mesin terpetakan ke alat ini ----
  if (!kosong(m.machineId) && String(act['Activity']).trim() === 'DIPASANG KE MESIN') {
    const toolCode = String(unit['Tool_Code']).trim();
    const dipetakan = ctx.toolMachine.some((p) =>
      String(p['Tool_Code']).trim() === toolCode && String(p['Machine_ID']).trim() === String(m.machineId).trim());
    if (!dipetakan) {
      put('Alat ' + toolCode + ' tidak dipakai di mesin ' + m.machineId + '. Daftarkan di Master Tool Machine dulu.');
    }
  }

  // ---- 15. tanggal tidak di masa depan ----
  if (!kosong(m.tanggal)) {
    const tgl = String(m.tanggal).slice(0, 10);
    if (tgl > tgl_()) put('Tanggal ' + tgl + ' melebihi hari ini (' + tgl_() + ').');
    // ---- 16. tanggal >= kejadian sebelumnya ----
    if (terakhir) {
      const tglSebelum = String(terakhir['Tanggal'] || '').slice(0, 10);
      if (tglSebelum && tgl < tglSebelum) {
        put('Tanggal ' + tgl + ' lebih awal dari kejadian sebelumnya (' + tglSebelum + ').');
      }
    }
  }

  return { valid: masalah.length === 0, masalah: masalah, statusSebelum: statusSebelum, toStatus: toStatus, toolCode: String(unit['Tool_Code']).trim() };
}

function selesai(masalah) {
  return { valid: false, masalah: masalah, statusSebelum: '', toStatus: '' };
}

/** Baca semua yang dibutuhkan validasi dalam satu kali lintasan. */
function bacaKonteks_() {
  return {
    units: nonempty_(rows_(sh_('M_TOOL_UNIT'), ['Unit_ID', 'Tool_Code', 'Opening_Status', 'Opening_Regrind', 'Cek'])),
    tools: nonempty_(rows_(sh_('M_TOOL'), ['Tool_Code', 'Tool_Name', 'Tool_Type', 'Max_Regrind', 'Default_Vendor_ID', 'Cek'])),
    machines: nonempty_(rows_(sh_('M_MACHINE'), ['Machine_ID', 'Machine_Name', 'Cek'])),
    vendors: nonempty_(rows_(sh_('M_VENDOR'), ['Vendor_ID', 'Vendor_Name', 'Aktif (Y/N)', 'SLA_Hari', 'Cek'])),
    activities: nonempty_(rows_(sh_('M_ACTIVITY'), ['Activity', 'From_1', 'From_2', 'To_Status', 'Need_Machine', 'Need_Vendor', 'Need_Order', 'Keterangan'])),
    toolMachine: nonempty_(rows_(sh_('M_TOOL_MACHINE'), ['Tool_Code', 'Machine_ID', 'Cek'])),
    orders: nonempty_(rows_(sh_('ORD'), ['Order_ID', 'Vendor_ID', 'Status', 'Qty_Kirim', 'Cek'])),
    movements: nonempty_(rows_(sh_('MOV'), ['Unit_ID (input)', 'Tanggal', 'Activity', 'Order_ID', 'To_Status'])),
  };
}