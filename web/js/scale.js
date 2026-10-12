/* ==========================================================================
   scale.js — SKALA NONIUS
   Elemen tanda tangan aplikasi ini.

   Bukan progress bar. Sebuah garis bertanda tetap dengan indeks yang
   bergerak, seperti skala pengukur. Jarak antar tanda berarti: satu tanda
   = satu kali asah. Warnanya mengikuti status toleransi, bukan hiasan.

   Dipakai untuk: keausan alat, level stok, umur tiket, umur di vendor.
   ========================================================================== */

/**
 * Hitung posisi indeks. Mengembalikan 0..1 sepanjang strip.
 * Indeks digeser +0.5 tick supaya penanda jelas berada di antara tanda.
 */
function posisi_(nilai, maks, banyak) {
  if (maks <= 0) return 0;
  const b = Math.max(banyak, 1);
  const geser = 0.5 / b;
  return Math.min(1, Math.max(0, (nilai / maks) * (1 - geser) + geser));
}

/** Status toleransi: menentukan warna, dan selalu ikut ditulis di teks. */
function status_(nilai, maks) {
  if (maks <= 0) return 'info';
  if (nilai >= maks) return 'luar';
  if (nilai === maks - 1) return 'dekat';
  return 'aman';
}

const WARNA = { aman: 'var(--aman)', dekat: 'var(--dekat)', luar: 'var(--luar)', info: 'var(--tinta-3)' };
const WARNA_LATAR = { aman: 'var(--aman-l)', dekat: 'var(--dekat-l)', luar: 'var(--luar-l)', info: 'var(--panel)' };

/**
 * Render skala ke dalam elemen.
 * @param {HTMLElement} wadah
 * @param {Object} o {nilai, maks, label, satuan, lebar}
 */
function renderSkala(wadah, o) {
  const nilai = Math.max(0, Number(o.nilai) || 0);
  const maks = Math.max(1, Number(o.maks) || 1);
  const lebar = o.lebar || 280;
  const tinggi = 44;
  const padKiri = 4, padKanan = 4;
  const panjang = lebar - padKiri - padKanan;
  const st = status_(nilai, maks);
  const banyak = Math.min(maks, 12);          // jangan gambar terlalu banyak tanda
  const x = (nilai / maks) * panjang;
  const idx = posisi_(nilai, maks, banyak);

  // lurch: teks yang selalu ikut berubah, supaya warna tidak jadi satu-satunya pembawa makna
  const lurch = `${o.label || 'Nilai'} ${nilai} dari ${maks}${o.satuan ? ' ' + o.satuan : ''}` +
    (st === 'luar' ? ' — sudah lewat batas' : st === 'dekat' ? ' — satu langkah lagi ke batas' : '');

  const tanda = [];
  for (let i = 0; i <= banyak; i++) {
    const tx = padKiri + (i / banyak) * panjang;
    const tinggiTanda = 8;
    tanda.push(`<line x1="${tx.toFixed(1)}" y1="${tinggi - 8}" x2="${tx.toFixed(1)}" y2="${tinggi - 8 - tinggiTanda}" stroke="var(--garis-kuat)" stroke-width="1"/>`);
    if (maks <= 8) {
      // Tanda yang akan tertutup penanda indeks diberi label lebih tinggi,
      // supaya angka batas (mis. "4") tetap terbaca.
      const tertutupi = Math.abs(i - nilai) < 0.55;
      const dy = tertutupi ? 34 : 22;
      tanda.push(`<text x="${tx.toFixed(1)}" y="${tinggi - dy}" font-size="9" font-family="var(--f-mono)" fill="${tertutupi ? WARNA[st] : 'var(--tinta-3)'}" text-anchor="${i === banyak ? 'end' : i === 0 ? 'start' : 'middle'}">${i}</text>`);
    }
  }
  // label "batas" di ujung kanan, ditulis miring supaya tidak bertabrakan
  if (maks > 8) {
    tanda.push(`<text x="${(padKiri + panjang).toFixed(1)}" y="10" font-size="9" font-family="var(--f-display)" fill="var(--luar)" text-anchor="end">batas ${maks}</text>`);
  } else {
    tanda.push(`<text x="${(padKiri + panjang).toFixed(1)}" y="10" font-size="9" font-family="var(--f-display)" fill="var(--luar)" text-anchor="end">batas</text>`);
  }

  wadah.innerHTML =
    `<div class="skala" style="background:${WARNA_LATAR[st]}">` +
      `<svg viewBox="0 0 ${lebar} ${tinggi}" width="100%" height="${tinggi}" role="img" aria-label="${lurch.replace(/"/g, '&quot;')}" preserveAspectRatio="none">` +
        `<line x1="${padKiri}" y1="${tinggi - 8}" x2="${lebar - padKanan}" y2="${tinggi - 8}" stroke="var(--garis)" stroke-width="1"/>` +
        tanda.join('') +
        // penanda batas: garis putus-putus di posisi maksimal
        `<line x1="${padKiri + panjang}" y1="4" x2="${padKiri + panjang}" y2="${tinggi - 6}" stroke="var(--luar)" stroke-width="1" stroke-dasharray="2 3"/>` +
        // indeks bergerak — satu-satunya bagian yang dianimasikan
        `<g class="skala-indeks" style="transform:translateX(${(idx * panjang).toFixed(1)}px)">` +
          `<polygon points="0,0 9,0 4.5,7" fill="${WARNA[st]}"/>` +
          `<line x1="4.5" y1="7" x2="4.5" y2="${tinggi - 6}" stroke="${WARNA[st]}" stroke-width="2.5"/>` +
        `</g>` +
      `</svg>` +
      `<span class="skala-lurch">${lurch}</span>` +
    `</div>`;
}

/** Panggil ulang render untuk menganimasikan perpindahan indeks. */
function geserSkala(wadah, nilaiBaru) {
  const g = wadah.querySelector('.skala-indeks');
  if (!g) return;
  const o = wadah.dataset;
  const maks = Math.max(1, Number(o.maks) || 1);
  const panjang = (wadah.querySelector('svg')?.viewBox?.baseVal?.width || 280) - 8;
  g.style.transform = `translateX(${(posisi_(nilaiBaru, maks, Math.min(maks, 12)) * panjang).toFixed(1)}px)`;
}

window.renderSkala = renderSkala;
window.geserSkala = geserSkala;