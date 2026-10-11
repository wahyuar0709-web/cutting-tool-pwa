/* ==========================================================================
   ui.js — pembantu tampilan. Satu fungsi kecil, satu tanggung jawab.
   ========================================================================== */

const UI = {
  /** escaped, karena data dari sheet bisa berisi karakter HTML. */
  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  /** Lencana status. Warna + teks, tidak pernah warna saja. */
  lencana(teks, kelas) {
    return `<span class="lencana ${kelas || 'info'}">${UI.esc(teks)}</span>`;
  },

  /** Kelas status dari nilai status unit. */
  kelasStatus(s) {
    switch (String(s || '').toUpperCase()) {
      case 'SIAP PAKAI': return 'aman';
      case 'DIPAKAI': return 'info';
      case 'MENUNGGU ASAH': return 'dekat';
      case 'DIASAH': return 'info';
      case 'SCRAP': return 'luar';
      case 'PERLU CEK': return 'dekat';
      default: return 'info';
    }
  },

  /** Pesan error/sukses dengan daftar masalah. */
  pesan(r) {
    if (r.ok) return `<div class="pesan sukses">${UI.esc(r.pesan || 'Tersimpan.')}</div>`;
    const daftar = (r.detail || []).length
      ? '<ul>' + r.detail.map((d) => `<li>${UI.esc(d)}</li>`).join('') + '</ul>'
      : '';
    return `<div class="pesan gagal">${UI.esc(r.pesan || 'Gagal.')}${daftar}</div>`;
  },

  /** Layar kosong — ajakan bertindak, bukan pesan apologik. */
  kosong(judul, isi, tombol) {
    return `<div class="kosong"><b>${UI.esc(judul)}</b><p>${UI.esc(isi || '')}</p>${tombol || ''}</div>`;
  },

  /** Toast singkat. Istilahnya sama persis dengan tombolnya. */
  toast(pesan, kelas) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.className = 'toast ' + (kelas || '');
    el.textContent = pesan;
    el.classList.add('tampil');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('tampil'), 3600);
  },

  /** Ambil nilai form sebagai objek biasa. */
  form(nama) {
    const o = {};
    document.querySelectorAll(`[data-field="${nama}"]`).forEach((el) => {
      if (el.type === 'checkbox') o[el.dataset.field] = el.checked;
      else o[el.dataset.field] = el.value;
    });
    return o;
  },
};

window.UI = UI;