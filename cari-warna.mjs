/* Cari nilai gelap terdekat dari tiap token status yang masih tetap terasa
   "warna yang sama", tapi kontrasnya lolos WCAG.
   node cari-warna.mjs                                                   */
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'web', 'css', 'tokens.css'), 'utf8');
const token = {};
for (const m of css.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) token[m[1]] = m[2];

const rgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const kontras = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return (hi + 0.05) / (lo + 0.05); };

const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Gelapkan warna secara proporsional sampai kontras terhadap latar tercapai. */
function sampai(target, bg, mulai, langkah = 0.97) {
  let [r, g, b] = rgb(mulai);
  for (let i = 0; i < 60; i++) {
    const c = hex(r, g, b);
    if (kontras(c, bg) >= target) return { hex: c, rasio: kontras(c, bg) };
    r *= langkah; g *= langkah; b *= langkah;
  }
  return { hex: '#000000', rasio: kontras('#000000', bg) };
}

const tugas = [
  ['tinta-3', 'lembar', 4.5, 'teks tersier di atas putih'],
  ['tinta-3', 'panel', 4.5, 'teks tersier di atas panel'],
  ['aman', 'aman-l', 4.5, '.lencana.aman'],
  ['aman', '#FFFFFF', 4.5, '#toast.sukses (putih di --aman)'],
  ['luar', 'luar-l', 4.5, '.lencana.luar'],
  ['luar', '#FFFFFF', 4.5, '#toast.gagal (putih di --luar)'],
  ['dekat', '#FFFFFF', 3.0, '.kecil-nilai.perlu-perlu 30px (teks besar)'],
];

console.log('token  | latar  | sekarang        | usulan            | rasio');
console.log('-------|--------|-----------------|-------------------|-------');
for (const [nama, latar, target, ket] of tugas) {
  const awal = token[nama];
  const bg = latar.startsWith('#') ? latar : token[latar];
  if (!bg) { console.log(`${nama} / ${latar}: latar tidak ditemukan`); continue; }
  const hasil = sampai(target, bg, awal);
  const s = kontras(awal, bg);
  const usul = hasil ? hasil.hex : '-';
  const r2 = hasil ? hasil.rasio : 0;
  console.log(`${nama.padEnd(6)} | ${latar.padEnd(6)} | ${awal} ${s.toFixed(2).padStart(5)} | ${usul} ${r2.toFixed(2).padStart(5)} | ${ket}`);
}