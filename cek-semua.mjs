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

// ---------- 5. kunci kontrak API ----------
console.log('\n[5] Kontrak API (frontend <-> backend)');
const mainGs = fs.readFileSync(path.join(root, 'src/Main.gs'), 'utf8');
const apiGs = new Set([...mainGs.matchAll(/function (api_\w+)\s*\(/g)].map((m) => m[1]));
const dipakaiApi = new Set([...fs.readFileSync(path.join(root, 'web/js/api.js'), 'utf8').matchAll(/panggil\('(api_\w+)'/g)].map((m) => m[1]));
for (const a of dipakaiApi) lap(apiGs.has(a), `Api.${a.replace('api_', '')} -> ${apiGs.has(a) ? 'ada di Main.gs' : 'HILANG'}`);
const takDipakai = [...apiGs].filter((a) => !dipakaiApi.has(a));
if (takDipakai.length) console.log(`  (info) api belum dipakai frontend: ${takDipakai.join(', ')}`);

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