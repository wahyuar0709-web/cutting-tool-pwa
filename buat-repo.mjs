/**
 * buat-repo.mjs — buat repo GitHub memakai kredensial yang sudah tersimpan di
 * Git Credential Manager. Token tidak pernah dicetak.
 */
import { execFileSync } from 'node:child_process';

const NAMA_REPO = process.argv[2] || 'cutting-tool-pwa';
const DESKRIPSI = process.argv[3] || 'PWA Monitoring Cutting Tool — pelacakan alat potong, pengasahan, dan stok.';

function kredensial() {
  const out = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const peta = {};
  out.split(/\r?\n/).forEach((b) => { const i = b.indexOf('='); if (i > 0) peta[b.slice(0, i).trim()] = b.slice(i + 1).trim(); });
  return peta;
}

const k = kredensial();
const token = k.password;
if (!token) { console.log('GAGAL: tidak ada token tersimpan untuk github.com'); process.exit(1); }
console.log(`memakai kredensial untuk: ${k.username || '(tanpa username)'}\n`);

async function api(path, metode = 'GET', body) {
  const r = await fetch(`https://api.github.com${path}`, {
    method: metode,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'cutting-tool-pwa-setup',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const teks = await r.text();
  let json = {};
  try { json = JSON.parse(teks); } catch { json = { pesan_mentah: teks.slice(0, 200) }; }
  return { status: r.status, json, headers: r.headers };
}

// ---- 1. siapa saya ----
const saya = await api('/user');
if (saya.status !== 200) {
  console.log('GAGAL autentikasi. Status', saya.status, '-', JSON.stringify(saya.json).slice(0, 200));
  console.log('Artinya token tersimpan tidak berlaku lagi. Perlu token baru.');
  process.exit(1);
}
const akun = saya.json.login;
const paket = saya.json.plan ? `${saya.json.plan.name} (${saya.json.plan.space})` : 'tidak dilaporkan';
console.log('LOGIN BERHASIL');
console.log('  akun   :', akun);
console.log('  paket  :', paket);
console.log(' Scopes dari header:');
const hdr = saya.headers.get('x-oauth-scopes');
if (hdr) hdr.split(',').forEach((s) => console.log('    -', s.trim()));
else console.log('    (token tidak melaporkan scope — token App Installation / Fine-grained)');

// ---- 2. apakah repo sudah ada ----
const cek = await api(`/repos/${akun}/${NAMA_REPO}`);
if (cek.status === 200) {
  console.log(`\nREPO SUDAH ADA: ${cek.json.html_url}`);
  console.log('  tidak ada yang dibuat ulang');
  process.exit(0);
}
console.log(`\nrepo "${NAMA_REPO}" belum ada -> membuatnya`);

// ---- 3. privat hanya kalau paket mendukung ----
const [, , privat] = process.argv;
const mauPrivat = privat === '--privat';
if (mauPrivat && !/pro|team|business|enterprise/.test(String(paket).toLowerCase())) {
  console.log(`  paket "${paket}" tidak mendukung repo privat -> dibuat PUBLIK`);
}
const privatFinal = mauPrivat && /pro|team|business|enterprise/.test(String(paket).toLowerCase());

// ---- 4. buat ----
const buat = await api('/user/repos', 'POST', {
  name: NAMA_REPO,
  description: DESKRIPSI,
  private: privatFinal,
  auto_init: false,
  has_issues: true,
  has_wiki: false,
  has_projects: false,
});

if (buat.status !== 201) {
  console.log('\nGAGAL membuat repo. Status', buat.status);
  console.log(JSON.stringify(buat.json).slice(0, 400));
  process.exit(1);
}

console.log('\nREPO DIBUAT');
console.log('  nama     :', buat.json.full_name);
console.log('  privat   :', buat.json.private);
console.log('  url      :', buat.json.html_url);
console.log('  clone    :', buat.json.clone_url);