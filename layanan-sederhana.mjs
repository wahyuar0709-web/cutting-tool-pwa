/* Server statis kecil untuk memeriksa tampilan secara lokal.
   node layanan-sederhana.mjs [porta]                                     */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'web');
const port = parseInt(process.argv[2], 10) || 8123;

const tipe = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const p = path.join(root, rel);
  // jangan keluar dari folder web
  if (!p.startsWith(root)) { res.writeHead(403).end('larangan'); return; }
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('tidak ditemukan: ' + rel); return; }
    res.writeHead(200, { 'content-type': tipe[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`melayani http://localhost:${port} dari ${root}`));