/**
 * aktifkan-pages.mjs — nyalakan GitHub Pages untuk repo ini.
 * Sumber: branch main, folder /web (folder tempat PWA berada).
 * Token diambil dari Git Credential Manager dan tidak pernah dicetak.
 */
import { execFileSync } from 'node:child_process';

const REPO = process.argv[2] || 'cutting-tool-pwa';
const BRANCH = process.argv[3] || 'main';
const PATH = process.argv[4] || '/web';

function token() {
  const out = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const baris = out.split(/\r?\n/).find((x) => x.startsWith('password='));
  if (!baris) { console.log('GAGAL: tidak ada token tersimpan'); process.exit(1); }
  return baris.slice(9).trim();
}

const t = token();

async function api(path, metode = 'GET', body) {
  const r = await fetch(`https://api.github.com${path}`, {
    method: metode,
    headers: {
      Authorization: `Bearer ${t}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'cutting-tool-pwa-setup',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const teks = await r.text();
  let json = {};
  try { json = JSON.parse(teks); } catch { json = { mentah: teks.slice(0, 300) }; }
  return { status: r.status, json };
}

const base = `/repos/wahyuar0709-web/${REPO}/pages`;

// ---- 1. sudah aktif? ----
const cek = await api(base);
if (cek.status === 200) {
  console.log('GitHub Pages SUDAH AKTIF');
  console.log('  url    :', cek.json.html_url || '(sedang dibangun)');
  console.log('  status :', cek.json.status);
  console.log('  sumber :', JSON.stringify(cek.json.source || {}));
} else if (cek.status === 404) {
  // ---- 2. belum aktif -> nyalakan ----
  console.log('GitHub Pages belum aktif -> menyalakan...');
  const buat = await api(base, 'POST', { source: { branch: BRANCH, path: PATH } });
  if (buat.status === 201 || buat.status === 200) {
    console.log('\nBERHASIL diaktifkan');
    console.log('  url    :', buat.json.html_url);
    console.log('  status :', buat.json.status);
    console.log('  sumber :', JSON.stringify(buat.json.source || {}));
  } else {
    console.log('\nGAGAL. Status', buat.status);
    console.log(JSON.stringify(buat.json).slice(0, 400));
  }
} else {
  console.log('Status tak terduga:', cek.status);
  console.log(JSON.stringify(cek.json).slice(0, 300));
}