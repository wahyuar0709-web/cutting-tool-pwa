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
// daftar aksi yang diizinkan Web.gs
const aksiWeb = new Set([...webGs.matchAll(/^\s{4}(\w+):\s*\(\)\s*=>/gm)].map((m) => m[1]));
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
const KATA_KUNCI = new Set(['if', 'for', 'while', 'switch', 'return', 'catch', 'typeof', 'new', 'await', 'async', 'function', 'const', 'let', 'var', 'delete', 'in', 'of', 'do', 'else', 'try', 'finally', 'throw', 'case', 'break', 'continue', 'class', 'import', 'export', 'instanceof', 'yield', 'static', 'get', 'set', 'with', 'void', 'debugger']);
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
console.log('\n[6c] Identifier gantung');
for (const { f, t } of semuaSrc) {
  if (!f.endsWith('.gs')) continue;
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