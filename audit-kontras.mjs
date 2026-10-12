/* Laporan kontras warna yang dirender aplikasi.
   Sumber aturan: kontras.mjs (sama dengan yang dipakai cek-semua.mjs).
   node audit-kontras.mjs                                               */
import path from 'node:path';
import { bacaToken, pasangan, kontras } from './kontras.mjs';

const root = process.cwd();
const token = bacaToken(root);

let gagal = 0;
let lolos = 0;

for (const p of pasangan()) {
  const fg = p.fg.startsWith('#') ? p.fg : token[p.fg];
  const bg = p.bg.startsWith('#') ? p.bg : token[p.bg];
  if (!fg || !bg) { console.log(`  LEWAT  ${p.ket} — token ${p.fg}/${p.bg} hilang`); gagal++; continue; }
  const besar = p.px >= 24 || (p.px >= 18.66 && p.w >= 700);
  const butuh = besar ? 3 : 4.5;
  const r = kontras(fg, bg);
  const ok = r >= butuh;
  ok ? lolos++ : gagal++;
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${r.toFixed(2).padStart(5)}:1  butuh ${butuh}  ${String(p.px).padStart(2)}px/${p.w}  ${p.ket}`);
  console.log(`          ${fg} di ${bg}`);
}

console.log(`\nRINGKASAN: ${gagal} gagal, ${lolos} lolos`);
process.exit(gagal ? 1 : 0);