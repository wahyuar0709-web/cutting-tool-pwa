/* Perbaiki mojibake di berkas web/: urutan byte UTF-8 yang salah baca sebagai cp1252.
   Menjalankan: node perbaiki-mojibake.mjs --periksa   (hanya laporan)
                node perbaiki-mojibake.mjs             (perbaiki)          */
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'web');
const hanyaPeriksa = process.argv.includes('--periksa');
// Skrip ini sendiri dan cek-semua.mjs SENGAJA memuat urutan rusak itu sebagai
// daftar pola, jadi keduanya tidak boleh ikut dihitung sebagai cacat.
const KECUALIKAN = new Set(['perbaiki-mojibake.mjs', 'cek-semua.mjs']);

// Dua urutan rusak yang ditemukan._byte aslinya menentukan karakter yang dimaksud.
const rusak = [
  { dari: 'â€”', ke: '—', isi: 'garis putus em (U+2014)' },
  { dari: 'â†’', ke: '→', isi: 'panah kanan (U+2192)' },
];

const berkas = [];
(function telusuri(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) telusuri(p);
    else if (/\.(js|css|html|json)$/.test(e.name) && !KECUALIKAN.has(e.name)) berkas.push(p);
  }
})(root);

let total = 0;
for (const f of berkas) {
  const asli = fs.readFileSync(f, 'utf8');
  let t = asli;
  let berubah = 0;
  for (const r of rusak) {
    const n = t.split(r.dari).length - 1;
    if (n) { t = t.split(r.dari).join(r.ke); berubah += n; }
  }
  if (!berubah) continue;
  total += berubah;
  console.log(`  ${path.relative(root, f)}: ${berubah} karakter -> ${rusak.map((r) => r.isi).join(', ')}`);
  if (!hanyaPeriksa) fs.writeFileSync(f, t, 'utf8');
}

console.log(`\n${hanyaPeriksa ? 'Ditemukan' : 'Diperbaiki'}: ${total} karakter mojibake`);

// verifikasi ulang: tidak boleh ada sisa
if (!hanyaPeriksa) {
  let sisa = 0;
  for (const f of berkas) {
    const t = fs.readFileSync(f, 'utf8');
    for (const r of rusak) sisa += t.split(r.dari).length - 1;
  }
  console.log(sisa === 0 ? 'Verifikasi: bersih, tidak ada sisa.' : `Verifikasi: MASIH ada ${sisa}!`);
  process.exit(sisa === 0 ? 0 : 1);
}