/**
 * Auth.gs — identitas pengguna dan pemetaan peran.
 * Sumber kebenaran: sheet `Master User`. Tidak ada sistem auth sendiri.
 */

/**
 * Profil pengguna yang sedang login.
 * @return {{email:string, nama:string, peran:string, plant:string, izin:string[]}}
 */
function profil_() {
  const email = Session.getActiveUser().getEmail() || '';
  if (!email) throw new Error('Email tidak terbaca. Masuk dengan akun Google yang terdaftar di Master User.');

  const sh = sh_('M_USER');
  const peta = header_(sh);
  const data = nonempty_(rows_(sh, ['Email', 'Nama', 'Peran', 'Plant', 'Aktif (Y/N)', 'Cek']));
  const saya = data.find((r) => String(r['Email']).trim().toLowerCase() === email.toLowerCase());

  if (!saya) {
    throw new Error(email + ' belum terdaftar di Master User. Minta admin gudang menambahkan email ini.');
  }
  if (String(saya['Aktif (Y/N)']).trim() !== 'Y') {
    throw new Error('Akun ' + email + ' sedang dinonaktifkan. Hubungi admin gudang.');
  }

  const peran = String(saya['Peran']).trim();
  if (!CONFIG.IZIN[peran]) {
    throw new Error('Peran "' + peran + '" tidak dikenal. Hubungi admin gudang.');
  }

  return {
    email: email,
    nama: String(saya['Nama'] || email).trim(),
    peran: peran,
    plant: String(saya['Plant'] || '').trim(),
    izin: CONFIG.IZIN[peran],
  };
}

/**
 * Pastikan pengguna punya izin tertentu. Panggil di DALAM withLock_ atau
 * tepat sebelumnya — jangan hanya mengandalkan sembunyikan tombol di klien.
 * @param {string} izin contoh: 'tiket.verifikasi'
 */
function butuhIzin_(izin) {
  const p = profil_();
  if (p.izin.indexOf(izin) === -1) {
    throw new Error('Peran ' + p.peran + ' tidak punya hak "' + izin + '".');
  }
  return p;
}

/** Daftar pengguna terdaftar — hanya untuk admin. */
function api_daftarPengguna() {
  butuhIzin_('master');
  try {
    const sh = sh_('M_USER');
    const data = nonempty_(rows_(sh, ['Email', 'Nama', 'Peran', 'Plant', 'Aktif (Y/N)', 'Cek']));
    return ok_(data.map((r) => ({
      email: String(r['Email'] || '').trim(),
      nama: String(r['Nama'] || '').trim(),
      peran: String(r['Peran'] || '').trim(),
      plant: String(r['Plant'] || '').trim(),
      aktif: String(r['Aktif (Y/N)'] || '').trim() === 'Y',
      cek: String(r['Cek'] || '').trim(),
    })));
  } catch (e) {
    return gagal_(e.message);
  }
}