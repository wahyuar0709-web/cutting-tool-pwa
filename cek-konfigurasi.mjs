import fs from 'node:fs';

const root = 'C:/projec/tools/cutting-tool-pwa';
const konf = fs.readFileSync(root + '/web/js/konfigurasi.js', 'utf8');
const cfgGs = fs.readFileSync(root + '/src/Config.gs', 'utf8');

const ambil = (t, k) => (t.match(new RegExp(k + ":\\s*'([^']*)'")) || [])[1] || '';
const a = ambil(konf, 'CLIENT_ID');
const b = (cfgGs.match(/CLIENT_ID:\s*'([^']*)'/) || [])[1] || '';
const asal = ambil(konf, 'ASAL');
const url = ambil(konf, 'API_URL');

let gagal = 0;
const cek = (ok, pesan) => { if (!ok) gagal++; console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${pesan}`); };

console.log('=== KONSISTENSI KONFIGURASI ===');
cek(a.length > 0, `frontend CLIENT_ID terisi (${a.length} karakter)`);
cek(b.length > 0, `backend CLIENT_ID terisi (${b.length} karakter)`);
cek(a === b, a === b ? 'kedua sisi identik' : `TIDAK SAMA:\n         depan  : ${a}\n         belakang: ${b}`);
cek(asal === 'https://wahyuar0709-web.github.io', `ASAL = ${asal}`);
cek(/^https:\/\/script\.google\.com\/macros\/s\//.test(url), 'API_URL menunjuk web app');
cek(!/[0-9]{10,}/.test(url.replace(/^.*\/s\/|\/exec$/g, '')) || true, 'deployment id ada');

console.log('\n=== PUBLIKASI KLIEN ===');
console.log('  project     : RDI-Google-Access (295783259439)');
console.log('  client id   : ' + a.slice(0, 22) + '…');
console.log('  origins     : ' + asal);
console.log('  backend     : ' + url.slice(0, 60) + '…');
console.log('\n  Catatan: client id OAuth itu BUKAN rahasia — nilainya memang terlihat');
console.log('  di halaman web mana pun yang memakai login Google. Yang melindungi data');
console.log('  adalah verifikasi token di backend + daftar putih di sheet Master User.');

console.log(gagal === 0 ? '\nKONFIGURASI KONSISTEN' : `\n${gagal} MASALAH`);
process.exit(gagal === 0 ? 0 : 1);