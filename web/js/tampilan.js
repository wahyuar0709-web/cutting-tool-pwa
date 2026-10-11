/* ==========================================================================
   tampilan.js — definisi layar. Satu layar = satu tugas.
   Operator tidak punya dashboard. SPV tidak punya tombol tulis.
   ========================================================================== */

const Layar = {

  /* ------------------------------------------------------------------ kartu alat */
  kartu: {
    peran: ['OPERATOR', 'ADMIN', 'SPV'],
    judul: 'Kartu alat',
    nav: 'Alat',
    ikon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    // alat pembuka: saw blade LEITZ 280X4/3X30_Z72 — unitnya sudah melewati batas asah,
    // jadi skala nonius langsung menunjukkan keadaan merah tanpa perlu menunggu.
    AWAL: 'LEI-SB-01',
    async render(wadah, app) {
      const kode = app.state.kartuKode || this.AWAL;
      const refs = app.cache.referensi;
      const tool = refs ? refs.tools.find((t) => t.kode === kode) : null;
      const pilih = refs
        ? refs.tools.map((t) => `<option value="${UI.esc(t.kode)}"${t.kode === kode ? ' selected' : ''}>${UI.esc(t.kode)} — ${UI.esc(t.nama)}</option>`).join('')
        : '';

      wadah.innerHTML =
        `<section class="panel">
           <h2>Cari alat</h2>
           <div class="cari-alat">
             <label class="label" for="in-kode">Kode alat atau nomor seri</label>
             <div class="cari-baris">
               <input id="in-kode" class="input mono" data-field="kartuKode" value="${UI.esc(kode)}" placeholder="LEU-CT-18" autocomplete="off">
               <button class="tombol utama" id="btn-cari">Cari</button>
             </div>
             <select class="pilih" id="in-pilih" aria-label="Pilih dari daftar alat">${pilih || '<option>Memuat daftar…</option>'}</select>
           </div>
         </section>
         <div id="hasil-kartu">`;

      const hasil = document.getElementById('hasil-kartu');
      if (!kode) {
        hasil.innerHTML = UI.kosong('Belum ada alat dipilih', 'Ketik kode alat atau pilih dari daftar.');
      } else {
        hasil.innerHTML = '<div class="kosong"><span class="memuat"></span></div>';
        const r = await Api.kartuAlat(kode);
        if (!r.ok) { hasil.innerHTML = UI.pesan(r); return; }
        hasil.innerHTML = renderKartu(r.data, tool);
        app.cache.kartu = r.data;
      }

      document.getElementById('btn-cari').onclick = () => { app.state.kartuKode = document.getElementById('in-kode').value.trim(); app.render(); };
      document.getElementById('in-pilih').onchange = (e) => { app.state.kartuKode = e.target.value; app.render(); };
      document.getElementById('in-kode').onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('btn-cari').click(); };
    },
  },

  /* ------------------------------------------------------------------ pengajuan */
  ajukan: {
    peran: ['OPERATOR', 'ADMIN'],
    judul: 'Ajukan pengasahan',
    nav: 'Ajukan',
    ikon: '<path d="M12 5v14M5 12h14"/>',
    async render(wadah, app) {
      const refs = app.cache.referensi;
      if (!refs) { wadah.innerHTML = '<div class="kosong"><span class="memuat"></span></div>'; return; }

      const alat = refs.tools.filter((t) => t.maks > 0);
      wadah.innerHTML =
        `<section class="panel">
           <h2>Ajukan pengasahan</h2>
           <p class="ket">Laporkan alat yang perlu diasah. Pilihan unit dikerjakan admin gudang.</p>
           <form id="form-ruit">
             <div class="baris-form">
               <label class="label" for="f-alat">Alat</label>
               <select id="f-alat" class="pilih" data-field="toolCode" required>
                 <option value="">— pilih alat —</option>
                 ${alat.map((t) => `<option value="${UI.esc(t.kode)}">${UI.esc(t.kode)} — ${UI.esc(t.nama)}</option>`).join('')}
               </select>
             </div>
             <div class="dua-kolom">
               <div class="baris-form">
                 <label class="label" for="f-mesin">Mesin <span class="opsional">(opsional)</span></label>
                 <select id="f-mesin" class="pilih" data-field="machineId">
                   <option value="">— tidak tahu / tidak diisi —</option>
                   ${refs.machines.map((m) => `<option value="${UI.esc(m.id)}">${UI.esc(m.id)} — ${UI.esc(m.nama)}</option>`).join('')}
                 </select>
               </div>
               <div class="baris-form">
                 <label class="label" for="f-jumlah">Jumlah unit</label>
                 <input id="f-jumlah" class="input num" type="number" min="1" step="1" value="1" data-field="qty" required>
               </div>
             </div>
             <div class="baris-form">
               <label class="label" for="f-kondisi">Kondisi</label>
               <select id="f-kondisi" class="pilih" data-field="kondisi">
                 ${refs.kondisi.map((k) => `<option>${UI.esc(k)}</option>`).join('')}
               </select>
             </div>
             <div class="baris-form">
               <label class="label" for="f-catatan">Catatan</label>
               <textarea id="f-catatan" class="area" data-field="catatan" placeholder="Misalnya: tumpul di sisi kanan, goresan halus"></textarea>
             </div>
             <div id="ruit-pesan"></div>
             <button class="tombol utama" type="submit">Kirim pengajuan</button>
           </form>
         </section>`;

      document.getElementById('form-ruit').onsubmit = async (ev) => {
        ev.preventDefault();
        const tombol = ev.target.querySelector('button[type=submit]');
        tombol.disabled = true; tombol.textContent = 'Mengirim…';
        const r = await Api.buatTicket(UI.form(null));
        tombol.disabled = false; tombol.textContent = 'Kirim pengajuan';
        const kotak = document.getElementById('ruit-pesan');
        kotak.innerHTML = UI.pesan(r);
        if (r.ok) {
          kotak.innerHTML = UI.pesan(r);
          UI.toast(r.pesan, 'sukses');
          setTimeout(() => { app.state.kartuKode = UI.form(null).toolCode; app.state.layar = 'kartu'; app.render(); }, 900);
        }
      };
    },
  },

  /* ------------------------------------------------------------------ tiket */
  tiket: {
    peran: ['OPERATOR', 'ADMIN', 'SPV'],
    judul: 'Pengajuan',
    nav: 'Pengajuan',
    ikon: '<path d="M8 3h8l4 4v14H4V3h4z"/><path d="M16 3v4h4"/><path d="M8 12h8M8 16h5"/>',
    async render(wadah, app) {
      wadah.innerHTML = '<div class="kosong"><span class="memuat"></span></div>';
      const r = await Api.daftarTiket({ limit: 60 });
      if (!r.ok) { wadah.innerHTML = UI.pesan(r); return; }
      const t = r.data || [];
      if (!t.length) { wadah.innerHTML = UI.kosong('Belum ada pengajuan', 'Pengajuan operator akan muncul di sini.'); return; }

      wadah.innerHTML =
        `<section class="panel">
           <h2>Pengajuan masuk</h2>
           <div class="tabel-gulir">
             <table>
               <thead><tr><th>Ticket</th><th>Tanggal</th><th>Alat</th><th class="num">Unit</th><th>Mesin</th><th>Kondisi</th><th>Status</th></tr></thead>
               <tbody>${t.map((x) => {
                 const status = String(x['Status_Verifikasi'] || 'Menunggu');
                 return `<tr>
                   <td class="mono">${UI.esc(x['Ticket_ID'])}</td>
                   <td class="mono">${UI.esc(String(x['Tanggal'] || '').slice(0, 10))}</td>
                   <td class="mono">${UI.esc(x['Tool_Code'])}</td>
                   <td class="num">${UI.esc(x['Qty'])}</td>
                   <td class="mono">${UI.esc(x['Machine_ID'] || '—')}</td>
                   <td>${UI.esc(x['Kondisi'])}</td>
                   <td>${UI.lencana(status, status.includes('Tolak') ? 'luar' : status === 'Menunggu' ? 'dekat' : 'aman')}</td>
                 </tr>`;
               }).join('')}</tbody>
             </table>
           </div>
         </section>`;
    },
  },

  /* ------------------------------------------------------------------ dashboard */
  ringkasan: {
    peran: ['OPERATOR', 'ADMIN', 'SPV'],
    judul: 'Ringkasan',
    nav: 'Ringkasan',
    ikon: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    async render(wadah, app) {
      wadah.innerHTML = '<div class="kosong"><span class="memuat"></span></div>';
      const r = await Api.dashboard();
      if (!r.ok) { wadah.innerHTML = UI.pesan(r); return; }
      const d = r.data;

      if (d.badge && !/BERSIH/.test(d.badge)) {
        wadah.innerHTML = `<div class="pesan gagal">Data belum bersih: ${UI.esc(d.badge)}. Perbaiki di Master Data Audit sebelum dipakai mengambil keputusan.</div>`;
      }

      const kartu = (label, nilai, catatan, kelas) =>
        `<div class="kecil"><span class="kecil-label">${UI.esc(label)}</span><b class="kecil-nilai ${kelas || ''} num">${UI.esc(nilai ?? '—')}</b><span class="kecil-catatan">${UI.esc(catatan || '')}</span></div>`;

      wadah.innerHTML =
        `<section class="panel">
           <h2>Antrean asah</h2>
           <p class="ket">Alat yang menunggu dan sedang diasah. Semakin lama menunggu, semakin tinggi risikonya.</p>
           <div class="kecil-kisi">
             ${kartu('Menunggu asah', d.menunggu, 'di gudang, tumpul', d.menunggu > 20 ? 'perlu-perlu' : '')}
             ${kartu('Sedang diasah', d.diVendor, 'di vendor', '')}
             ${kartu('Siap pakai', d.siap, 'bisa dipasang', 'aman')}
             ${kartu('Dipakai', d.dipakai, 'di mesin', '')}
           </div>
         </section>

         <section class="panel">
           <h2>Perlu keputusan</h2>
           <div class="kecil-kisi">
             ${kartu('Sudah lewat batas asah', d.wajibScrap, 'perlu diputuskan ganti', d.wajibScrap > 0 ? 'luar' : 'aman')}
             ${kartu('Hampir batas', d.hampirMaks, 'satu langkah lagi', d.hampirMaks > 0 ? 'perlu-perlu' : '')}
             ${kartu('Stok habis', d.habis, 'item kosong', d.habis > 0 ? 'luar' : 'aman')}
             ${kartu('Stok kritis', d.kritis, 'di bawah batas pesan', d.kritis > 0 ? 'perlu-perlu' : '')}
           </div>
         </section>

         <section class="panel">
           <h2>Data & aturan</h2>
           <div class="kecil-kisi">
             ${kartu('Total unit', d.totalUnit, 'tercatat aktif', '')}
             ${kartu('Perlu cek', d.perluCek, 'menunggu pemeriksaan', d.perluCek > 0 ? 'perlu-perlu' : 'aman')}
             ${kartu('Galat data', d.totalError, 'harus nol', d.totalError > 0 ? 'luar' : 'aman')}
             ${kartu('Peringatan', d.totalPeringatan, 'informasi, bukan galat', '')}
           </div>
         </section>`;
    },
  },

  /* ------------------------------------------------------------------ pengaturan */
  pengaturan: {
    peran: ['ADMIN'],
    judul: 'Pengaturan',
    nav: 'Sistem',
    ikon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    async render(wadah, app) {
      wadah.innerHTML = '<div class="kosong"><span class="memuat"></span></div>';
      const r = await Api.healthCheck();
      if (!r.ok) { wadah.innerHTML = UI.pesan(r); return; }
      const h = r.data;
      const box = (judul, isi) => `<section class="panel"><h2>${UI.esc(judul)}</h2>${isi}</section>`;

      const kap = (h.ringkasan.kapasitas || []).map((k) =>
        `<tr><td>${UI.esc(k.sheet)}</td><td class="num">${UI.esc(k.terisi)}</td><td class="num">${UI.esc(k.grid)}</td>
         <td class="num">${k.sisa < 300 ? UI.lencana(k.sisa + ' baris', 'dekat') : UI.esc(k.sisa)}</td></tr>`).join('');

      wadah.innerHTML =
        box('Kapasitas', `<div class="tabel-gulir"><table><thead><tr><th>Sheet</th><th>Terisi</th><th>Grid</th><th>Sisa</th></tr></thead><tbody>${kap}</tbody></table></div>`) +
        box('Aturan scrap', `<p>Unit aktif: <b>${UI.esc(h.ringkasan.scrap.total)}</b> · tanpa Max_Regrind: <b>${UI.esc(h.ringkasan.scrap.tanpaMaks)}</b> · sisa negatif: <b>${UI.esc(h.ringkasan.scrap.negatif)}</b></p>`) +
        box('Badge data', `<p>${/BERSIH/.test(h.ringkasan.badge) ? UI.lencana('BERSIH', 'aman') : UI.lencana(h.ringkasan.badge || 'tidak terbaca', 'luar')}</p>`) +
        box('Sel error per sheet', (h.ringkasan.selError || []).length
          ? `<ul>${h.ringkasan.selError.map((e) => `<li>${UI.esc(e)}</li>`).join('')}</ul>`
          : '<p>Tidak ada nilai galat di seluruh workbook.</p>') +
        box('Hasil', h.sehat
          ? UI.lencana('SEHAT', 'aman')
          : `<div class="pesan gagal"><ul>${h.masalah.map((m) => `<li>${UI.esc(m)}</li>`).join('')}</ul></div>`);
    },
  },
};

/** Kartu alat + skala nonius. */
function renderKartu(d, tool) {
  const perStatus = Object.entries(d.perStatus || {}).map(([k, v]) =>
    UI.lencana(`${k} · ${v}`, UI.kelasStatus(k))).join(' ');

  const baris = d.units.map((u) =>
    `<tr>
      <td class="mono">${UI.esc(u.unitId)}</td>
      <td class="mono">${UI.esc(u.ident || '—')}</td>
      <td>${UI.lencana(u.status || '?', UI.kelasStatus(u.status))}</td>
      <td class="num">${UI.esc(u.regrind)} / ${UI.esc(u.maks)}</td>
      <td>${u.flag === 'WAJIB EVALUASI SCRAP' ? UI.lencana('Ganti', 'luar') : u.flag === 'HAMPIR MAKS REGRIND' ? UI.lencana('Hampir batas', 'dekat') : '<span class="redup">—</span>'}</td>
    </tr>`).join('');

  const paling = d.units.reduce((a, u) => (u.regrind > (a?.regrind ?? -1) ? u : a), null);
  const nama = tool ? tool.nama : '';

  return `<section class="panel kartu-alat">
      <h2>${UI.esc(d.toolCode)}${nama ? ' · ' + UI.esc(nama) : ''}</h2>
      <div class="kartu-alat-kepala">
        <div class="kartu-alat-utama">
          <span class="kartu-alat-label">Unit dengan keausan tertinggi</span>
          <b class="kartu-alat-unit mono">${UI.esc(paling ? paling.unitId : '—')}</b>
          <div class="skala-wadah" id="skala-utama"></div>
        </div>
        <div class="kartu-alat-samping">
          <span class="kartu-alat-label">Total unit</span>
          <b class="kartu-alat-angka num">${UI.esc(d.total)}</b>
          <div class="kartu-alat-status">${perStatus}</div>
        </div>
      </div>
    </section>
    <section class="panel">
      <h2>Daftar unit</h2>
      <div class="tabel-gulir"><table>
        <thead><tr><th>Unit</th><th>Nomor seri</th><th>Status</th><th class="num">Asah / batas</th><th>Catatan</th></tr></thead>
        <tbody>${baris}</tbody>
      </table></div>
    </section>`;
}

window.Layar = Layar;
window.renderKartu = renderKartu;