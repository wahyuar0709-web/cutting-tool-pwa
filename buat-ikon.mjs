/**
 * buat-ikon.mjs — menghasilkan ikon PWA tanpa library.
 * Motif: bilah gergaji bundar (subjek: saw blade), digambar dengan uji jarak per piksel.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

const OUT = 'C:/projec/tools/cutting-tool-pwa/web/assets';
fs.mkdirSync(OUT, { recursive: true });

// ---- PNG encoder minimal ----
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return (buf) => { let c = -1; for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();

function chunk(tipe, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(tipe, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function png(w, h, piksel) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  const baris = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    baris[y * (1 + w * 4)] = 0; // filter none
    piksel.copy(baris, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(baris, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- motif: bilah gergaji ----
const TINTA = [0x0B, 0x2E, 0x6F];
const BIRU  = [0x15, 0x65, 0xF0];
const PUTIH = [0xFF, 0xFF, 0xFF];

function gambar(ukuran) {
  const px = Buffer.alloc(ukuran * ukuran * 4);
  // ruang aman untuk ikon maskable: gambar occupies 80% kanvas
  const skala = 0.80;
  const c = ukuran / 2;
  const R = (ukuran * 0.5) * skala;  // radius badan bilah
  const tinggiGigi = R * 0.17;
  const jumlahGigi = 30;
  const put = (x, y, rgb, a = 255) => {
    const i = (y * ukuran + x) * 4;
    px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = a;
  };

  const diluarBilah = (dx, dy) => {
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > R * 1.2 || d < R * 0.001) return { dalam: false, d };
    const sudut = Math.atan2(dy, dx);
    // gelombang gergaji: 0 -> 1 dalam satu periode, lalu turun mendadak
    const t = ((sudut * jumlahGigi) / (2 * Math.PI));
    const fraksi = t - Math.floor(t);
    const batas = R + tinggiGigi * fraksi;
    return { dalam: d <= batas, d };
  };

  for (let y = 0; y < ukuran; y++) {
    for (let x = 0; x < ukuran; x++) {
      const dx = x - c + 0.5, dy = y - c + 0.5;
      const { dalam, d } = diluarBilah(dx, dy);
      if (!dalam) { put(x, y, 0, 0); continue; }

      if (d <= R) put(x, y, TINTA);
      else put(x, y, BIRU);           // hanya ujung gigi yang biru
    }
  }

  // garis skala nonius, DIPOTONG agar tidak keluar dari bilah
  const yGaris = Math.round(c + R * 0.52);
  const xMulai = Math.round(c - R * 0.70), xSelesai = Math.round(c + R * 0.70);
  for (let x = xMulai; x <= xSelesai; x++) {
    const dy = (yGaris - c + 0.5);
    const d = Math.sqrt((x - c + 0.5) * (x - c + 0.5) + dy * dy);
    if (d > R * 0.94) continue;
    const t = (x - xMulai) / (xSelesai - xMulai);
    if (Math.floor(t * 13) % 2 === 0) put(x, yGaris, PUTIH);
  }

  // lubang poros
  for (let y = 0; y < ukuran; y++) {
    for (let x = 0; x < ukuran; x++) {
      const dx = x - c + 0.5, dy = y - c + 0.5;
      if (Math.sqrt(dx * dx + dy * dy) <= R * 0.13) put(x, y, PUTIH);
    }
  }
  return png(ukuran, ukuran, px);
}

for (const s of [192, 512]) {
  const f = `${OUT}/icon-${s}.png`;
  fs.writeFileSync(f, gambar(s));
  console.log(`  ${f}  ${(fs.statSync(f).size / 1024).toFixed(1)} KB`);
}

// ikon favicon kecil
fs.writeFileSync(`${OUT}/favicon.png`, gambar(64));
console.log(`  ${OUT}/favicon.png`);

// ikon untuk iOS (apple-touch-icon butuh PNG)
fs.copyFileSync(`${OUT}/icon-192.png`, `${OUT}/apple-touch-icon.png`);
console.log(`  ${OUT}/apple-touch-icon.png`);