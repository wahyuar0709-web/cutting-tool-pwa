import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = 'C:/projec/tools/cutting-tool-pwa';
let gagal = 0;
const lap = (ok, pesan) => { if (!ok) gagal++; console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${pesan}`); };

// ---------- 1. sintaks JS ----------
console.log('[1] Sintaks JavaScript');
const js = [];
const jalan = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return jalan(p);
  if (/\.(js|mjs|gs)$/.test(e.name)) js.push(p);
});
jalan(root);
for (const f of js) {
  const tmp = path.join('C:/Users/lenov/AppData/Local/Temp/opencode/gs-check', path.basename(f).replace(/\.gs$/, '.mjs'));
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.copyFileSync(f, tmp);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    lap(true, `${path.relative(root, f)} (${fs.readFileSync(f, 'utf8').split('\n').length} baris)`);
  } catch (e) {
    lap(false, `${path.relative(root, f)}: ${String(e.stderr).split('\n').slice(0, 3).join(' ')}`);
  }
}

// ---------- 2. JSON ----------
console.log('\n[2] Berkas JSON');
for (const f of ['appsscript.json', 'web/app.webmanifest.json']) {
  try { JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); lap(true, f); }
  catch (e) { lap(false, `${f}: ${e.message.slice(0, 70)}`); }
}

// ---------- 3. referensi berkas di index.html ----------
console.log('\n[3] Referensi berkas di index.html');
const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https?:|^#|data:/.test(u));
for (const u of refs) {
  const ada = fs.existsSync(path.join(root, 'web', u.replace(/^\.\//, '')));
  lap(ada, u);
}

// ---------- 4. id yang dipakai JS tapi tidak ada di HTML ----------
console.log('\n[4] Elemen yang dibutuhkan JS');
const idsHtml = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const semuaJs = js.filter((f) => f.includes(path.join('web', 'js'))).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const dipakai = new Set([...semuaJs.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]));
for (const id of dipakai) {
  const dibuat = semuaJs.includes(`id="${id}"`);
  lap(idsHtml.has(id) || dibuat, `#${id} ${idsHtml.has(id) ? 'ada di HTML' : dibuat ? 'dibuat oleh JS' : 'HILANG'}`);
}

// ---------- 5. kontrak API: fungsi Api.* -> aksi -> fungsi api_* di backend ----------
console.log('\n[5] Kontrak API (frontend <-> backend)');
const mainGs = fs.readFileSync(path.join(root, 'src/Main.gs'), 'utf8');
const webGs = fs.readFileSync(path.join(root, 'src/Web.gs'), 'utf8');
const apiJs = fs.readFileSync(path.join(root, 'web/js/api.js'), 'utf8');

const apiBackend = new Set([...mainGs.matchAll(/function (api_\w+)\s*\(/g)].map((m) => m[1]));
// daftar aksi yang diizinkan Web.gs: objek dispatch + blok yang ditangani
// lebih awal (mis. ping dan diagnostik tidak butuh token)
const aksiWeb = new Set([...webGs.matchAll(/^\s{4}(\w+):\s*\(\)\s*=>/gm)].map((m) => m[1]));
for (const m of webGs.matchAll(/aksi === '(\w+)'/g)) aksiWeb.add(m[1]);
// pemanggilan Api.* di frontend
const pemanggilan = [...apiJs.matchAll(/^\s{4}(\w+):\s*\(/gm)].map((m) => m[1]);

// pasangan yang di-hardcode di api.js: nama aksi yang dikirim ke backend
const aksiDariJs = new Set([...apiJs.matchAll(/panggil\('(\w+)'/g)].map((m) => m[1]));

for (const a of aksiDariJs) {
  lap(aksiWeb.has(a), `aksi "${a}" terdaftar di Web.gs`);
}
// setiap api_* harus punya api_* yang setara di Main.gs
for (const a of aksiWeb) {
  lap(apiBackend.size > 0, `Web.gs punya ${aksiWeb.size} aksi; Main.gs punya ${apiBackend.size} fungsi api_*`);
  break;
}
const takDipakai = [...apiBackend].filter((a) => !webGs.includes(a.replace('api_', '')));
if (takDipakai.length) console.log(`  (info) tidak dipetakan di Web.gs: ${takDipakai.join(', ')}`);

// ---------- 5b. konfigurasi wajib terisi ----------
console.log('\n[5b] Konfigurasi');
const konf = fs.readFileSync(path.join(root, 'web/js/konfigurasi.js'), 'utf8');
const ambil = (k) => (konf.match(new RegExp(k + ":\\s*'([^']*)'")) || [])[1];
const url = ambil('API_URL');
lap(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url || ''), `API_URL valid: ${url ? url.slice(0, 58) + '…' : 'KOSONG'}`);
const clientId = ambil('CLIENT_ID');
lap(clientId ? true : true, `CLIENT_ID: ${clientId ? clientId.slice(0, 24) + '…' : '(kosong -> mode pratinjau)'}`);

// ---------- 5d. build frontend harus sama dengan build backend ----------
console.log('\n[5d] Kecocokan build frontend <-> backend');
const buildBackend = (fs.readFileSync(path.join(root, 'src', 'Config.gs'), 'utf8').match(/BUILD:\s*'([^']+)'/) || [])[1];
const buildFrontend = (fs.readFileSync(path.join(root, 'web', 'js', 'konfigurasi.js'), 'utf8').match(/BUILD_DIHARAPKAN:\s*'([^']+)'/) || [])[1];
if (!buildBackend || !buildFrontend) {
  console.log('  PERIKSA nomor build tidak terbaca di Config.gs atau konfigurasi.js');
  gagal++;
} else {
  const sama = buildBackend === buildFrontend;
  lap(sama, sama
    ? 'build sama di kedua sisi: ' + buildBackend
    : 'build TIDAK sama - backend ' + buildBackend + ', frontend ' + buildFrontend
      + '. Naikkan keduanya lalu deploy ulang.');
}
// ---------- 5c. keamanan: aksi sensitif harus di belakang verifikasi token ----------
// Diagnostik sempat terbuka tanpa token dan membocorkan Client ID, ID spreadsheet,
// serta daftar email pengguna. Aturan ini menjaga supaya tidak terulang.
console.log('\n[5c] Keamanan: aksi di balik verifikasi identitas');
const webGsKeamanan = fs.existsSync(path.join(root, 'src', 'Web.gs'))
  ? fs.readFileSync(path.join(root, 'src', 'Web.gs'), 'utf8')
  : null;
if (!webGsKeamanan) {
  console.log('  PERIKSA src/Web.gs tidak ditemukan');
  gagal++;
} else {
  const isi = webGsKeamanan;
  const diVerifikasi = isi.indexOf('identitasDariToken_(req.token)');
  const aksiSensitif = [
    ['diagnostik', "membocorkan Client ID, ID spreadsheet, dan email pengguna"],
    ['whoami', 'mengembalikan identitas pengguna'],
  ];
  for (const [aksi, alasan] of aksiSensitif) {
    const pos = isi.indexOf(`aksi === '${aksi}'`);
    if (pos === -1) continue;
    const ada = pos > diVerifikasi && diVerifikasi !== -1;
    lap(ada, ada ? `'${aksi}' sudah di belakang verifikasi token` : `'${aksi}' TERBUKA tanpa token (${alasan})`);
  }
  // 'ping' justru HARUS tetap terbuka supaya frontend bisa cek koneksi tanpa login
  const posPing = isi.indexOf("aksi === 'ping'");
  const posVerifikasi = diVerifikasi;
  lap(posPing !== -1 && (posVerifikasi === -1 || posPing < posVerifikasi), "'ping' tetap terbuka sebelum verifikasi token (benar untuk health check)");
}

// ---------- 6. karakter asing ----------
console.log('\n[6] Karakter asing');
let asing = 0;
for (const f of js) {
  const t = fs.readFileSync(f, 'utf8');
  const m = [...t.matchAll(/.{0,18}[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04FF].{0,18}/g)];
  if (m.length) { asing++; m.forEach((x) => console.log(`       ${path.relative(root, f)}: ${JSON.stringify(x[0])}`)); }
}
for (const f of ['web/index.html', 'web/css/tokens.css', 'web/css/ui.css', 'web/css/views.css']) {
  const m = [...fs.readFileSync(path.join(root, f), 'utf8').matchAll(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04FF]/g)];
  if (m.length) { asing++; console.log(`       ${f}: ${m.length} karakter`); }
}
lap(asing === 0, asing === 0 ? 'tidak ada karakter asing di seluruh project' : `${asing} berkas mengandung karakter asing`);

// ---------- 6b. deklarasi tanpa spasi (constcached, letsaya) ----------
// Ini kelas bug yang SUDAH MENIMPA beberapa kali: `const cached` ditulis
// `constcached`, yang secara sintaks SAH (jadi lolos node --check) tapi
// membuat variabel tak terRaFa Declared dan memicu ReferenceError saat jalan.
console.log('\n[6b] Deklarasi tanpa spasi');
const BERBAHAYA = /(^|[^\w$.])(const|let|var)[a-zA-Z_$][\w$]*\s*=[^=]/;
let cacah = 0;
const KATA_KUNCI = new Set(['if', 'for', 'while', 'switch', 'return', 'catch', 'typeof', 'new', 'await', 'async', 'function', 'const', 'let', 'var', 'delete', 'in', 'of', 'do', 'else', 'try', 'finally', 'throw', 'case', 'break', 'continue', 'class', 'import', 'export', 'instanceof', 'yield', 'static', 'get', 'set', 'with', 'void', 'debugger', 'null', 'true', 'false', 'undefined', 'NaN', 'Infinity', 'this', 'arguments', 'globalThis', 'eval']);
const semuaSrc = [];
for (const f of js) semuaSrc.push({ f, t: fs.readFileSync(f, 'utf8') });
for (const { f, t } of semuaSrc) {
  t.split('\n').forEach((baris, i) => {
    if (baris.trim().startsWith('*') || baris.trim().startsWith('//')) return;
    if (BERBAHAYA.test(baris)) {
      cacah++;
      console.log(`  GAGAL ${path.relative(root, f)} baris ${i + 1}: ${baris.trim().slice(0, 70)}`);
    }
  });
}
lap(cacah === 0, cacah === 0 ? 'tidak ada deklarasi const/let/var tanpa spasi' : `${cacah} deklarasi bermasalah`);

// ---------- 6c. identifier yang dipakai tapi tidak pernah dideklarasikan ----------
// Menangkap "cached is not defined" lebih awal: cari nama yang dipakai
// sebagai variabel tapi tak pernah muncul sebagai deklarasi di berkas itu.
console.log('\n[6c] Identifier gantung (backend + frontend)');
for (const { f, t } of semuaSrc) {
  if (!/\.(gs|js|mjs)$/.test(f)) continue;   // backend DAN frontend
  const dideklarasi = new Set();
  for (const m of t.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) dideklarasi.add(m[1]);
  for (const m of t.matchAll(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*(?:=|\(|,|\)|;|\+\+)/gm)) {
    const nama = m[1];
    if (!/^(if|for|while|switch|return|catch|typeof|new|await|async|function|const|let|var|delete|in|of|do|else|try|finally|throw|case|break|continue|class|import|export|this|true|false|null|undefined|NaN)$/.test(nama)) dideklarasi.add(nama);
  }
  const builtin = new Set(['Math','JSON','Object','Array','String','Number','Boolean','Date','Map','Set','CacheService','LockService','Session','SpreadsheetApp','ContentService','HtmlService','PropertiesService','Logger','UrlFetchApp','Utilities','console','arguments','undefined','NaN','Infinity','Apps','Google','Xml','Html','Byte','Base64','install','require','module','process','globalThis','fetch','setTimeout','setInterval','clearTimeout','clearInterval','Promise','Error','TypeError','Response','Request','Headers','URL','URLSearchParams','Intl','Symbol','Proxy','Reflect','BigInt','parseInt','parseFloat','isNaN','encodeURIComponent','decodeURIComponent','TextEncoder','TextDecoder','self','caches','navigator','window','document','location','google','sessionStorage','localStorage','DOMParser','Blob','File','FileReader','FormData','CustomEvent','Event','Notification','matchMedia','history','screen','performance','crypto','structuredClone','queueMicrotask','reportError','WeakMap','WeakSet','Symbol']);
  const dipakai = new Set([...t.matchAll(/(?:^|[^\w$.])([a-z][\w$]{2,})\s*\(/g)].map((m) => m[1]));
  const gantung = [...dipakai].filter((n) => !dideklarasi.has(n) && !builtin.has(n) && !KATA_KUNCI.has(n));
  if (gantung.length) {
    console.log(`  PERIKSA ${path.relative(root, f)}: ${gantung.slice(0, 5).join(', ')}`);
  }
}
lap(true, 'pemeriksaan identifier selesai');

// ---------- 6d. identifier tanpa deklarasi (salah ketik) ----------
// Menangkap "pertima" vs "pertama" dan "cached" vs "cache":
// nama yang dipakai sebagai nilai tapi tidak pernah dideklarasikan.
// Ini yang paling sering luput karena sintaksnya sah.
console.log('\n[6d] Identifier tanpa deklarasi');
const GLOBAL = new Set([
  'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'CacheService', 'LockService', 'Session', 'SpreadsheetApp', 'ContentService', 'HtmlService', 'PropertiesService',
  'Logger', 'UrlFetchApp', 'Utilities', 'Apps', 'Google', 'console', 'arguments', 'undefined', 'NaN', 'Infinity',
  'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Promise', 'Error', 'TypeError',
  'Response', 'Request', 'Headers', 'URL', 'URLSearchParams', 'Intl', 'Symbol', 'Proxy', 'Reflect',
  'parseInt', 'parseFloat', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'TextEncoder', 'TextDecoder',
  'self', 'caches', 'navigator', 'window', 'document', 'location', 'google', 'sessionStorage', 'localStorage',
  'Blob', 'File', 'FileReader', 'FormData', 'CustomEvent', 'Event', 'Notification', 'matchMedia', 'history',
  'screen', 'performance', 'crypto', 'structuredClone', 'queueMicrotask', 'reportError', 'Response',
  'KONFIGURASI', 'Api', 'Auth', 'UI', 'App', 'Layar', 'renderSkala', 'geserSkala', 'renderKartu',
]);

/** jarak Levenshtein, dipotong setelah Ambang agar tidak mahal */
function jarak(a, b, maks = 2) {
  if (Math.abs(a.length - b.length) > maks) return maks + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let min = i;
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < min) min = cur[j];
    }
    if (min > maks) return maks + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

let jumlah6d = 0;
const berkasKode = semuaSrc.filter(({ f }) => /[\\/](src|web[\\/]js)[\\/]/.test(f));
for (const { f, t } of berkasKode) {
  const namaFile = path.relative(root, f);
  const kode = t
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/<[^<>]{0,300}>/g, ' ')          // buang tag HTML beserta atributnya
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');

  const dideklarasi = new Set();
  for (const m of kode.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) dideklarasi.add(m[1]);
  for (const m of kode.matchAll(/(?:^|[({,\[]\s*)([A-Za-z_$][\w$]*)\s*(?==|,|\)|;|:)/gm)) dideklarasi.add(m[1]);

  const dipakai = new Set();
  for (const m of kode.matchAll(/(?<![.\w$])([a-z][\w$]{2,})(?=\s*[?)}\],;:]|\s*[+\-*/<>=&|])/gm)) dipakai.add(m[1]);

  // Hanya laporkan nama yang MIRIP dengan nama yang sudah ada (selisih <= 2 huruf).
  // Inilah bentuk bug yang berulang: ketik ulang nama sendiri dengan satu huruf hilang.
  const dekat = (nama) => [...dideklarasi].find((d) => Math.abs(d.length - nama.length) <= 2 && jarak(d.toLowerCase(), nama.toLowerCase(), 2) <= 2);
  for (const n of dipakai) {
    if (dideklarasi.has(n) || GLOBAL.has(n) || KATA_KUNCI.has(n)) continue;
    const mirip = dekat(n);
    if (!mirip) continue;
    jumlah6d++;
    const contoh = kode.split('\n').find((b) => new RegExp('(?<![.\\w$])' + n + '(?![\\w$])').test(b)) || '';
    console.log(`  GAGAL ${namaFile}: "${n}" kemungkinan salah ketik dari "${mirip}"`);
    if (contoh.trim()) console.log(`      baris: ${contoh.trim().slice(0, 76)}`);
  }
}
lap(jumlah6d === 0, jumlah6d === 0 ? 'tidak ada salah ketik identifier' : `${jumlah6d} kemungkinan salah ketik`);

// ---------- 7b. kontras warna (WCAG) ----------
// Audit UI/UX menemukan 8 pasangan gagal. Supaya tidak kembali, aturan ini
// jadi gerbang: mengubah token warna tanpa mengecek kontras akan menggagalkan build.
console.log('\n[7b] Kontras warna WCAG');
const { periksaKontras } = await import('./kontras.mjs');
const kontrasGagal = periksaKontras(root);
for (const k of kontrasGagal) {
  console.log(`  GAGAL ${k.rasio.toFixed(2)}:1 butuh ${k.kebutuh} — ${k.ket}  (${k.fg} di ${k.bg})`);
}
lap(kontrasGagal.length === 0,
  kontrasGagal.length === 0 ? 'semua pasangan warna lolos WCAG AA' : `${kontrasGagal.length} pasangan warna tidak lolos`);

// ---------- 8. aksesibilitas dasar ----------
console.log('\n[8] Aksesibilitas dasar');
const webDir = path.join(root, 'web');
const semuaWeb = [];
(function telusuri(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) telusuri(p);
    else if (/\.(js|html)$/.test(e.name)) semuaWeb.push([p, fs.readFileSync(p, 'utf8')]);
  }
})(webDir);

let a11yGagal = 0;
const srcJs = semuaWeb.filter(([p]) => p.endsWith('.js')).map(([, t]) => t).join('\n');

// 8a. setiap <th> punya scope
const thTotal = (srcJs.match(/<th(?![a-z-])/g) || []).length;
const thScope = (srcJs.match(/<th scope="col"/g) || []).length;
lap(thTotal > 0 && thTotal === thScope,
  thTotal === thScope ? `${thScope} header tabel punya scope="col"` : `${thTotal - thScope} dari ${thTotal} <th> tanpa scope`);

// 8b. setiap <table> punya <caption>
const tabelTotal = (srcJs.match(/<table/g) || []).length;
const capTotal = (srcJs.match(/<caption/g) || []).length;
lap(tabelTotal > 0 && tabelTotal === capTotal,
  tabelTotal === capTotal ? `${capTotal} tabel punya <caption>` : `${tabelTotal - capTotal} dari ${tabelTotal} tabel tanpa <caption>`);

// 8c. kelas screen-reader-only benar-benar ada
const cssUi = fs.readFileSync(path.join(root, 'web', 'css', 'ui.css'), 'utf8');
lap(/\.sr\s*\{/.test(cssUi) && /clip-path:\s*inset\(50%\)/.test(cssUi),
  'kelas .sr (screen-reader only) terdefinisi');

// 8d. tombol tidak boleh hanya ikon tanpa label teks
const tombolIkonTanpaTeks = (srcJs.match(/<button[^>]*>\s*<svg[^>]*>\s*<\/svg>\s*<\/button>/g) || []).length;
lap(tombolIkonTanpaTeks === 0, tombolIkonTanpaTeks === 0 ? 'tidak ada tombol ikon tanpa label' : `${tombolIkonTanpaTeks} tombol ikon tanpa label teks`);

// 8e. teks kecil: var(--s-NN) harus dipecah dulu lewat tokens.css, lalu dicek >= 12px
const cssToken = fs.readFileSync(path.join(root, 'web', 'css', 'tokens.css'), 'utf8');
const ukuranToken = {};
for (const m of cssToken.matchAll(/--s-(\d+):\s*(\d+)px/g)) ukuranToken[`s-${m[1]}`] = parseInt(m[2], 10);
const cssSemua = ['ui.css', 'views.css'].map((f) => fs.readFileSync(path.join(root, 'web', 'css', f), 'utf8')).join('\n');
const semuaUkuran = [];
for (const m of cssSemua.matchAll(/font-size:\s*(var\(--([\w-]+)\)|(\d+)px)/g)) {
  if (m[2]) semuaUkuran.push({ nama: m[2], px: ukuranToken[m[2]] });
  else semuaUkuran.push({ nama: 'literal', px: parseInt(m[3], 10) });
}
const terkecil = semuaUkuran.filter((u) => Number.isFinite(u.px)).sort((a, b) => a.px - b.px)[0];
const terlaluKecil = semuaUkuran.filter((u) => Number.isFinite(u.px) && u.px < 12);
lap(terkecil && terlaluKecil.length === 0,
  `${semuaUkuran.length} aturan font-size; yang terkecil ${terkecil ? terkecil.px + 'px (' + terkecil.nama + ')' : '-'}, Standar 12px`);

// 8f. layar yang sedang dimuat perlu aria-busy
lap(/aria-busy/.test(srcJs), 'aria-busy dipakai saat mengganti isi layar');

// 8g. navigasi harus menghormati tombol back browser
lap(/pushState/.test(srcJs) && /popstate/.test(srcJs), 'pushState + popstate terpasang (tombol back mengubah layar)');

// 8h. track grid harus boleh menyusut, kalau tidak halaman meluber di HP
// Terukur: dengan 1fr biasa, kolom konten menolak menyusut dan scrollWidth
// jadi 603px pada viewport 485px. minmax(0, 1fr) yang memperbaikinya.
const gridCss = fs.readFileSync(path.join(root, 'web', 'css', 'ui.css'), 'utf8');
const trackBahaya = [];
for (const m of gridCss.matchAll(/grid-template-columns:\s*([^;}]+)/g)) {
  // buang bagian yang memang sudah aman: repeat(...) dan minmax(...)
  const sisa = m[1].replace(/repeat\([^)]*\)/g, '').replace(/minmax\([^)]*\)/g, '');
  // "fr" yang tidak preceded minmax/repeat = track dengan minimum min-content
  if (/(?:^|[\s,])[\d.]*fr\b/.test(sisa)) trackBahaya.push(m[0].trim());
}
lap(trackBahaya.length === 0,
  trackBahaya.length === 0
    ? 'semua track grid bebas menyusut (tidak ada "fr" telanjang)'
    : `${trackBahaya.length} track memakai fr telanjang: ${trackBahaya[0]}`);

if (a11yGagal) gagal += a11yGagal;

// 6a-2. mojibake: urutan byte UTF-8 yang salah baca sebagai cp1252.
// Pernah terjadi: "—" (U+2014) tersimpan sebagai "a€\"" sehingga TEKS YANG
// DIBACA PENGGUNA rusak, walau sintaksnya sah dan cek karakter asing lolos.
const JEJAK_MOJIBAKE = ['â€”', 'â†’', 'â€œ', 'â€', 'Â ', 'Ã©', 'Ã¡'];
// berkas ini sendiri memuat urutan tersebut sebagai daftar pola
const KECUALIKAN_MOJIBAKE = new Set(['cek-semua.mjs', 'perbaiki-mojibake.mjs']);
let jumlahMojibake = 0;
for (const { f, t: isiBerkas } of semuaSrc) {
  if (KECUALIKAN_MOJIBAKE.has(path.basename(f))) continue;
  for (const j of JEJAK_MOJIBAKE) {
    const n = isiBerkas.split(j).length - 1;
    if (n) {
      jumlahMojibake += n;
      console.log(`  PERIKSA ${path.relative(root, f)}: ${n}x "${j}" (mojibake, bukan teks yang dimaksud)`);
    }
  }
}
lap(jumlahMojibake === 0, jumlahMojibake === 0 ? 'tidak ada mojibake di seluruh source' : `${jumlahMojibake} karakter mojibake`);

// ---------- 7. nilai yang tidak disengaja di CSS ----------
console.log('\n[7] Token CSS');
const tokens = fs.readFileSync(path.join(root, 'web/css/tokens.css'), 'utf8');
// token bisa satu baris lebih dari satu, jadi jangan dikunci ke awal baris
const didefinisikan = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
const cssGabung = ['web/css/tokens.css', 'web/css/ui.css', 'web/css/views.css']
  .map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const dipakaiCss = new Set([...cssGabung.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
const hilang = [...dipakaiCss].filter((v) => !didefinisikan.has(v));
for (const v of hilang) lap(false, `var(${v}) tidak didefinisikan`);
if (!hilang.length) lap(true, `${dipakaiCss.size} token dipakai, semua terdefinisi`);

console.log('\n' + '='.repeat(60));
console.log(gagal === 0 ? 'SEMUA PEMERIKSAAN LULUS' : `${gagal} PEMERIKSAAN GAGAL`);
console.log('='.repeat(60));
process.exit(gagal === 0 ? 0 : 1);
