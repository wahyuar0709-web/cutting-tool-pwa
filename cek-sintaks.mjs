import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = 'C:/projec/tools/cutting-tool-pwa/src';
const tmp = 'C:/Users/lenov/AppData/Local/Temp/opencode/gs-check';
fs.mkdirSync(tmp, { recursive: true });

let gagal = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.gs'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  // Apps Script pakai .gs yang isinya JS biasa; hanya ekstensi yang beda
  const sementara = path.join(tmp, f.replace(/\.gs$/, '.mjs'));
  fs.writeFileSync(sementara, src, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', sementara], { stdio: 'pipe' });
    console.log(`  OK    ${f.padEnd(18)} ${src.split('\n').length} baris`);
  } catch (e) {
    gagal++;
    console.log(`  GAGAL ${f}`);
    console.log(String(e.stderr || e.message).split('\n').slice(0, 6).map((x) => '        ' + x).join('\n'));
  }
}

console.log(gagal === 0 ? '\nsemua file .gs sintaksnya valid' : `\n${gagal} file bermasalah`);

// cek juga: tidak ada karakter asing di source
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.gs'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const found = [...src.matchAll(/.{0,20}[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04FF].{0,20}/g)];
  if (found.length) found.forEach((m) => console.log(`  KARAKTER ASING di ${f}: ${JSON.stringify(m[0])}`));
}
console.log('pemeriksaan karakter asing selesai');