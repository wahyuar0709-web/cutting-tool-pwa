/* kontras.mjs — sumber tunggal untuk aturan kontras warna.
   Dipakai dua kali:
     - audit-kontras.mjs  : laporan rinci
     - cek-semua.mjs      : gerbang (gagal bila ada yang tidak lolos)
   Jangan duplikasi daftar pasangan warna di tempat lain.               */
import fs from 'node:fs';
import path from 'node:path';

export function bacaToken(root) {
  const css = fs.readFileSync(path.join(root, 'web', 'css', 'tokens.css'), 'utf8');
  const token = {};
  for (const m of css.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) token[m[1]] = m[2];
  return token;
}

const rgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const kontras = (a, b) => {
  const l1 = lum(a), l2 = lum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

/* Setiap entri harus mencerminkan pemakaian NYATA di CSS.
   Kalau warna status dipakai untuk teks, tulis varian -teks-nya. */
export function pasangan() {
  return [
    { fg: 'tinta', bg: 'lembar', px: 14, w: 400, ket: 'body: teks isi utama' },
    { fg: 'tinta-2', bg: 'lembar', px: 13, w: 400, ket: '.pesan, .kepala .saya, tabel' },
    { fg: 'tinta-3', bg: 'lembar', px: 12, w: 400, ket: '.redup, .kecil-catatan, label kartu' },
    { fg: 'tinta-3', bg: 'panel', px: 12, w: 400, ket: '.redup di atas panel' },
    { fg: 'tinta-3', bg: 'dekat-l', px: 13, w: 400, ket: 'banner mode pratinjau' },
    { fg: 'tinta', bg: 'panel', px: 14, w: 400, ket: 'teks di panel' },
    { fg: 'tinta-2', bg: 'panel', px: 12, w: 600, ket: 'th tabel, .label' },
    { fg: 'tinta-2', bg: 'panel-2', px: 12, w: 600, ket: 'label di panel sedang' },
    { fg: 'tinta', bg: 'luar-l', px: 13, w: 400, ket: '.pesan.gagal' },
    { fg: 'tinta', bg: 'aman-l', px: 13, w: 400, ket: '.pesan.sukses' },
    { fg: 'aman', bg: 'aman-l', px: 12, w: 600, ket: '.lencana.aman' },
    { fg: 'dekat-teks', bg: 'dekat-l', px: 12, w: 600, ket: '.lencana.dekat' },
    { fg: 'luar', bg: 'luar-l', px: 12, w: 600, ket: '.lencana.luar' },
    { fg: 'biru', bg: 'buru', px: 12, w: 600, ket: '.lencana.info' },
    { fg: 'aman', bg: 'lembar', px: 30, w: 700, ket: '.kecil-nilai.aman' },
    { fg: 'dekat-teks', bg: 'lembar', px: 30, w: 700, ket: '.kecil-nilai.perlu-perlu' },
    { fg: 'luar', bg: 'lembar', px: 30, w: 700, ket: '.kecil-nilai.luar' },
    // hex langsung di CSS
    { fg: '#FFFFFF', bg: '#1565F0', px: 13, w: 600, ket: '.tombol.utama' },
    { fg: '#FFFFFF', bg: '#0B47C4', px: 13, w: 600, ket: '.tombol.utama:hover' },
    { fg: '#B9CDF0', bg: 'tinta', px: 12, w: 400, ket: '.nav-item label di nav gelap' },
    { fg: '#7FA8E8', bg: 'tinta', px: 15, w: 700, ket: '.nav-judul' },
    { fg: '#FFFFFF', bg: 'aman', px: 14, w: 600, ket: '#toast.sukses' },
    { fg: '#FFFFFF', bg: 'luar', px: 14, w: 600, ket: '#toast.gagal' },
    { fg: '#FFFFFF', bg: 'tinta', px: 14, w: 600, ket: '#toast biasa' },
  ];
}

/** Kembalikan daftar kegagalan. Kosong = semua lolos. */
export function periksaKontras(root) {
  const token = bacaToken(root);
  const gagal = [];
  for (const p of pasangan()) {
    const fg = p.fg.startsWith('#') ? p.fg : token[p.fg];
    const bg = p.bg.startsWith('#') ? p.bg : token[p.bg];
    if (!fg || !bg) { gagal.push({ ...p, alasan: `token ${p.fg}/${p.bg} tidak ada`, rasio: 0, butuh: 0 }); continue; }
    const besar = p.px >= 24 || (p.px >= 18.66 && p.w >= 700);
    const butuh = besar ? 3 : 4.5;
    const rasio = kontras(fg, bg);
    if (rasio < butuh) gagal.push({ ...p, fg, bg, rasio, butuh });
  }
  return gagal;
}