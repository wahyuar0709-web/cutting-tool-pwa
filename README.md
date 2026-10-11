# Monitoring Cutting Tool — PWA

Aplikasi pelacakan alat potong (saw blade & cutter) untuk pabrik RDI.
Spreadsheet **tetap jadi database**; aplikasi ini antarmuka dan gerbang
mutu di depannya.

```
Operator Produksi ─┐
Admin Gudang      ─┼─→  PWA (vanilla JS)  ─→  Apps Script (.gs)  ─→  Google Sheets
SPV Atasan        ─┘        │                       │                      │
                          │                       │ LockService           │ kolom rumus
                    service worker          CacheService + validasi   (tidak pernah ditulis)
```

## Peran

| Peran | Hak |
|---|---|
| `OPERATOR` | lihat ringkasan, kartu alat, **mengajukan pengasahan** |
| `ADMIN` | semua akses admin: verifikasi tiket, pilih unit, kirim/terima vendor, catat movement, master data |
| `SPV` | baca saja: ringkasan, kartu alat, pengajuan, ekspor |

Pendaftaran lewat sheet `Master User` (kolom Email, Nama, Peran, Plant, Aktif).

## Menjalankan

```bash
npm i -g @google/clasp
clasp login
cp .clasp.json.example .clasp.json   # isi scriptId setelah `clasp create`
clasp push
```

Lalu di editor Apps Script: **Deploy → New deployment → Web app**
- *Execute as*: **Me**
- *Who has access*: **Anyone in <domain perusahaan>**

## Aturan keselamatan yang tidak boleh dilanggar

Aturan-aturan ini berasal dari insiden nyata saat sistem dibangun. Semuanya
sudah dijaga di kode, dan **tidak boleh dihapus** tanpa SADAR akan
menyebabkan kehilangan data.

| # | Aturan | Kenapa ada | Dijaga di |
|---|---|---|---|
| S1 | Tulis **kolom input saja** | Menulis nilai kosong ke kolom rumus menghapus validasi | `CONFIG.INPUT_COLUMNS`, `Repo.tulisInput_` |
| S2 | Tanggal harus nilai date asli | Tanggal teks membuat Safety Stock & Reorder Point selalu bernilai 1 | `Util.tgl_`, `Repo.catatMovement_` |
| S3 | Semua tulis lewat kunci eksklusif | Tiga orang menulis bersamaan; tanpa kunci, baris bisa tertimpa diam-diam | `Util.withLock_` |
| S4 | Tulis hanya baris kosong | Jangan menimpa riwayat | `Util.barisKosong_` |
| S5 | **Jangan** `findReplace` range lokal | `$A$2:$A$73` ikut mengenai sheet lain → `#VALUE!` merambat ke dashboard | `Maintenance.extendSheet_` |
| S6 | Perbesar grid + isi rumus berpasangan | Grid besar saja tidak cukup; rujukan yang masih menunjuk baris lama membuat aturan scrap mati tanpa error | `Maintenance.extendSheet_` |
| S7 | `String.replace` pakai replacer function | `'$1000'` dibaca sebagai backreference `$1` → hasilnya `$73000` | — (kode JS) |
| S8 | Pindai seluruh workbook setelah menulis | Kerusakan muncul di tempat yang tidak disentuh | `Maintenance.healthCheck_` |
| S9 | Baca sel berdasarkan label, bukan nomor baris | `values.get` melewati baris kosong sehingga indeks bergeser | `header_`, `api_dashboard` |

## Validasi sebelum pakai

```bash
node cek-semua.mjs      # sintaks, kontrak API, token CSS, referensi berkas
node cek-sintaks.mjs    # sintaks .gs saja
```

Untuk spreadsheet, dari repo utama:

```bash
node tools/gsheets-audit/cek-kesehatan.mjs
```

Keluarannya harus `SEHAT` sebelum dan sesudah setiap perubahan produksi.

## Struktur

```
src/                 backend Apps Script
├─ Config.gs            konstanta + daftar putih kolom input
├─ Util.gs              sheet, header, tanggal, ID, locking
├─ Auth.gs              profil & izin
├─ Validate.gs          16 aturan dari kolom Cek
├─ Repo.gs              satu-satunya tempat yang menulis
├─ Main.gs              fungsi api_* untuk google.script.run
└─ Maintenance.gs       healthCheck + extendSheet

web/                 PWA statis
├─ index.html
├─ css/                 tokens · ui · views
├─ js/                  api · ui · scale · tampilan · app
├─ assets/              ikon (dihasilkan oleh ../buat-ikon.mjs)
├─ app.webmanifest.json
└─ sw.js                service worker
```

## Datang dari mana

Rencana lengkap, keputusan desain, dan catatan risiko ada di
[`docs/PLAN-PWA-MONITORING-CUTTING-TOOL.md`](docs/PLAN-PWA-MONITORING-CUTTING-TOOL.md).
Riwayat migrasi dan semua temuan ada di
[`docs/ANALISIS-MIGRASI-MOVEMENT-LOG.md`](docs/ANALISIS-MIGRASI-MOVEMENT-LOG.md).

## Status

Tahap awal (F0–F1): kerangka, peran, kartu alat, pengajuan.
Belum ada antrean verifikasi admin, management order vendor, atau CRUD master.