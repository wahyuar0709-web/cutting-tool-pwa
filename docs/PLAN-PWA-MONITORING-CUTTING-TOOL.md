# Rencana Lengkap — PWA `Monitoring Cutting Tool`

> Dokumen ini adalah **rencana**, belum implementasi.
> Sumber kebenaran data: Google Sheets `Monitoring Cutting Tool`
> (ID `1TQd2aUErMypDsrlbKaos1j8WHha_FqX5F7fXlgglhN0`) — spreadsheet **tetap jadi database**.

---

## 1. Subjek yang Didesain

**Subjek:** alat potong (saw blade & cutter) yang dipinjam-pakai berulang antara
gudang, mesin produksi, dan vendor asah, sampai Dinaikkan menjadi scrap.

**Audiens:** tiga orang dengan pekerjaan yang sangat berbeda dan tidak boleh
dipakai dengan satu tampilan yang sama:

| Peran | Orangnya | Keadaan pemakaian | Kebutuhan tunggal |
|---|---|---|---|
| **Operator Produksi** | Operator shift | Berdiri di samping mesin, satu tangan memegang alat, sinyal jelek | "Alat ini sudah tumpul — saya ajukan asah, sekarang." |
| **Admin Warehouse** | Admin gudang | Duduk di meja, inbound & outbound jalan, vendor menelepon | "Antrean mana yang macet, dan angka mana yang harus saya sorot."
| **SPV Atasan** | SPV | Membuka HP di ruang rapat, 30 detik | "Apakah ada yang merah hari ini." |

**Tugas tunggal tiap halaman:** hanya satu. Halaman operator tidak punya dashboard.
Halaman SPV tidak punya tombol tulis.

---

## 2. Keputusan Arsitektur

### 2.1 Kenapa backend = Google Apps Script (bukan langsung Sheets API dari browser)

Enam alasan, semuanya dari pengalaman nyata dengan spreadsheet ini:

| # | Alasan | Kenapa menentukan |
|---|---|---|
| 1 | **LockService** | Tiga orang menulis bersamaan. Skrip Node yang saya buat **tidak punya locking** — dua admin bisa menulis baris yang sama dan menimpa. Apps Script punya `LockService.getScriptLock()`. |
| 2 | **Identitas pengguna** | `Session.getActiveUser().getEmail()` enforcing peran tanpa membangun sistem auth sendiri. |
| 3 | **Kolom rumus terlindungi** | Skrip server boleh menulis **hanya kolom input**. Kolom `Cek`, `Err_Flag`, `To_Status` dst. milik Sheets. |
| 4 | **Kolom otomatis** | `Transaction_ID`, `Status`, `Life_No`, `Cek` dihitung rumus — tidak pernah ditulis manual. |
| 5 | **Tanpa biaya** | Tidak ada server, tidak ada database, tidak ada API key bocor. |
| 6 | **Sesuai konvensi repo** | `AGENTS.md`: backend `.gs`, deploy via `clasp push`. |

### 2.2 Bentuk aplikasi

```
┌─────────────────┐   google.script.run   ┌──────────────────┐   LockService
│  PWA (vanilla)  │ ────────────────────► │  Apps Script .gs │ ─────────► ┌──────────┐
│  HTML/CSS/JS    │ ◄──────────────────── │  ClaspController │             │ Sheets   │
│  Service Worker │   {ok, data, pesan}    │  Validator       │             │ (DB)     │
│  IndexedDB      │                       │  Repo (CRUD)     │             └──────────┘
└─────────────────┘                       └──────────────────┘
                                                 │
                                                 ▼ DriveApp
                                          Foto pengajuan
```

**Struktur folder**

```
tools/cutting-tool-pwa/
├─ appsscript.json
├─ src/
│  ├─ Main.gs              # entry point + routing peran
│  ├─ Auth.gs              # whitelist email, peran, sesi
│  ├─ Repo/
│  │  ├─ MasterRepo.gs     # Master Tool/Unit/Machine/Vendor (read + upsert)
│  │  ├─ TicketRepo.gs     # Regrind Requests
│  │  ├─ OrderRepo.gs      # Regrind Orders
│  │  ├─ MovementRepo.gs   # Tool Movements (append-only)
│  │  └─ ReportRepo.gs     # Dashboard, Stock, Unit Status, Vendor
│  ├─ Validate/
│  │  └─ Cek.gs            # 14 aturan dari kolom Cek (lihat §7)
│  ├─ Media.gs             # Foto → DriveApp
│  ├─ Maintenance.gs       # healthCheck, extendSheet, repairFormula
│  └─ Util.gs              # kolom, id, tanggal, zona waktu
├─ web/                    # PWA statis
│  ├─ index.html  app.webmanifest.json  sw.js
│  ├─ css/tokens.css  ui.css  views.css
│  ├─ js/app.js  api.js  auth.js  router.js  queue.js  ui.js  scale.js
│  └─ views/  operator.html  admin.html  spv.html
├─ .clasp.json
└─ README.md
```

**Kenapa vanilla tanpa build step?** Repo ini diurus orang yang juga
mengurusnya. Tanpa bundler, satu file = satu tanggung jawab, `clasp push`
langsung jadi. AI größer tidak menambah nilai di sini.

---

## 3. Matriks Hak Akses

| Kemampuan | Operator | Admin | SPV |
|---|:--:|:--:|:--:|
| Lihat dashboard (ringkas) | ✅ | ✅ | ✅ |
| Lihat stok & status unit | ✅ | ✅ | ✅ |
| Scan alat → lihat kartu riwayat | ✅ | ✅ | ✅ |
| **Ajukan pengasahan** | ✅ | ✅ | — |
| Lihat tiket miliknya sendiri | ✅ | ✅ | ✅ semua |
| **Verifikasi tiket & pilih unit** | — | ✅ | — |
| **Kirim ke vendor / buat order** | — | ✅ | — |
| **Terima kembali dari vendor** | — | ✅ | — |
| **Catat movements (pasang/kembali/scrap)** | — | ✅ | — |
| **Kelola master data** | — | ✅ | — |
| Ekspor laporan | — | ✅ | ✅ |

Role disimpan di sheet baru `Master User`:
`Email | Nama | Peran | Plant | Aktif (Y/N) | Dibuat_Oleh | Tanggal`

> Penambahan sheet = perubahan produksi, jadi **butuh persetujuan terpisah**
> sebelum dieksekusi.

---

## 4. Model Data — Pemetaan ke Spreadsheet

### 4.1 Sheet yang dibaca aplikasi

| Sheet | Peran | Akses |
|---|---|---|
| `Master Tool` | katalog alat | baca + tulis (admin) |
| `Master Tool Unit` | daftar unit fisik | baca + tulis (admin) |
| `Master Tool Machine` | alat ↔ mesin | baca + tulis (admin) |
| `Master Machine`, `Master Vendor`, `Master Activity Type`, `Master Status Code` | referensi | baca + tulis (admin) |
| `Master Configuration` | parameter sistem | baca + tulis (admin) |
| `Regrind Requests` | tiket pengajuan | tulis (operator buat, admin proses) |
| `Regrind Orders` | order vendor | tulis (admin) |
| `Tool Movements` | log kejadian | **append saja** |
| `Stock Overview`, `Unit Status Report`, `Vendor Performance`, `DASHBOARD` | laporan | baca saja |

### 4.2 Kolom input vs kolom rumus — batas yang tidak boleh dilanggar

| Sheet | **Hanya boleh ditulis aplikasi** | **Milik Sheets, jangan sentuh** |
|---|---|---|
| `Tool Movements` | B–L (Tanggal, Date_Source, Unit_ID, Activity, Machine_ID, Vendor_ID, Order_ID, PIC, Reference_ID, Source, Remark) | M–AF (32 kolom rumus) |
| `Regrind Orders` | A–G, J | H–S |
| `Regrind Requests` | A–J | K–Q |
| `Master Tool Unit` | A–K | L (`Cek`) |
| `Master Tool` | A–N | O (`Cek`) |

> **Pelajaran yang mahal:** menulis baris dengan nilai `''` di ujung rentang
> menghapus rumus di kolom terakhir. Kontrak: `repo.appendMovement()` hanya
> menulis kolom B–L, tidak pernah mengirim array sepanjang 32 kolom.

### 4.3 Format identifier

| Jenis | Format | Contoh |
|---|---|---|
| Ticket pengajuan | `TRG-YYYY-NNNN` | `TRG-2026-0042` |
| Order vendor | `ORD-YYYY-NNNN` | `ORD-2026-0187` |
| Unit_ID | `<Tool_Code>-<3 digit>` | `LEU-CT-18-004` |
| Transaction_ID | dibuat Sheets | `TRX-2026-000123` |

---

## 5. Alur Kerja per Peran

### 5.1 Operator — Ajukan Pengasahan (mobile, di samping mesin)

```
   Berdiri di mesin, alat di tangan
              │
   [ Scan QR / ketik Tool_Code ]
              │
              ▼
   ┌──────────────────────────────┐
   │  KARTU ALAT                  │
   │  LEU-CT-18 · Cutter LEUCO    │
   │  ▓▓▓▓░░░░░  sudah asah 2 dari 4 │  ← skala nonius
   │  terpasang di RDS020          │
   │  terakhir asah 8 Sep · 21 hari │
   └──────────────────────────────┘
              │
        [ Tumpul — ajukan asah ]
              │
              ▼
   Form: jumlah · kondisi · foto · catatan
              │
        [ Kirim pengajuan ]
              │
              ▼
   TRG-2026-0042 dibuat · "Dikirim ke admin gudang"
   (bisa offline — antre di HP, terkirim saat ada sinyal)
```

**Aturan:** operator **tidak** memilih unit. Dia hanya melaporkan apa yang dia lihat.
Pemilihan unit milik admin gudang — itu keputusan gudang, bukan operator.

### 5.2 Admin — Verifikasi & Kirim (desktop)

```
 Tiket masuk → [ Setujui & pilih unit ]
                    │
          ┌─────────┴─────────┐
          │ unit di gudang:   │
          │ SIAP PAKAI  ● 3   │   Freshest first (Life_No terkecil)
          │ MENUNGGU ASAH ● 1 │
          └─────────┬─────────┘
          [pilih] [tolak: alasan]
                    │
                    ▼
  Ticket status: `Dipilih` · unit terkunci
                    │
  [ Buat order vendor ] → group unit per vendor
                    │
  ORD-2026-0187 · V04 LEUco · No SJ
                    │
  [ Tandai terkirim ] → Sheet: Tool Movements `KIRIM KE VENDOR ASAH`
                    │
                 ... 44 hari median ...
                    │
  [ Terima kembali ]  → Tool Movements `SELESAI DIASAH`
                       Life_No naik otomatis → bisa kena flag scrap
```

### 5.3 SPV — Baca (desktop & HP)

```
  "Ada yang merah?" — jawab dalam 30 detik
      │
      ▼
  ┌────────────────────────────────────────┐
  │  ANTREAN ASAH                          │
  │  MENUNGGU ASAH ▓▓▓▓▓▓░░░  32 unit    │
  │  DIASAH       ▓▓▓▓▓▓▓▓░  64 unit    │
  │                ↑ garis SLA             │
  │  median 44 hari · SLA V01 33 hari     │
  └────────────────────────────────────────┘
      │
      ▼
  Daftar yang perlu keputusan (bukan semua angka)
  · 19 unit sudah ≥ 4 kali asah → ganti?
  · 29 unit menunggu > 7 hari
  · Item HABIS: 7 (LEU-CT-18, LEU-CT-14, …)
```

---

## 6. Modul Fungsional

| # | Modul | Isi |
|---|---|---|
| M1 | **Autentikasi & Peran** | Login Google → peta peran → menu sesuai peran |
| M2 | **Kartu Alat** | Scan/ketik → riwayat, status, Life_No, di mesin mana,vendor mana |
| M3 | **Pengajuan Asah** | Form + foto + validasi + antre offline |
| M4 | **Antrean Tiket** | List, filter status, detail, approve/tolak dengan alasan |
| M5 | **Pemilihan Unit** | Kandidat dari gudang, freshest-first, kunci unit |
| M6 | **Order Vendor** | Buat order,(No SJ), kirim, terima, Void |
| M7 | **Movements** | Pasang / kembali / tumpul / scrap + PIC |
| M8 | **Stok & Reorder** | Stok per item, SS/ROP, saran beli |
| M9 | **Dashboard** | Ringkasan eksekutif, aging, vendor SLA |
| M10 | **Master Data** | CRUD 8 sheet master + validasi |
| M11 | **Mode Offline** | Queue di IndexedDB, sync, indikator koneksi |
| M12 | **Pemeliharaan** | `healthCheck`, `extendSheet`, `repairFormula` |

---

## 7. Mesin Validasi — 14 Aturan dari Kolom `Cek`

Kolom `Cek` di `Tool Movements` sudah jadi gerbang mutu. **Aplikasi harus
meniru aturan yang sama di server**, supaya baris cacat tidak pernah masuk.

| # | Aturan | Pesan ke pengguna |
|---|---|---|
| 1 | `Unit_ID` ada di `Master Tool Unit` | `Unit ini belum terdaftar di master` |
| 2 | `Activity` valid | `Jenis kegiatan tidak dikenal` |
| 3 | `PIC` terisi | `PIC belum diisi` |
| 4 | `Date_Source` terisi | `Sumber tanggal belum diisi` |
| 5 | Tanggal ada (kecuali `UNKNOWN`) | `Isi tanggal, atau tandai UNKNOWN` |
| 6 | Transisi status sesuai `Master Activity Type` | `Tidak bisa dari SIAP PAKAI ke KIRIM VENDOR` |
| 7 | `Machine_ID` wajib bila `Need_Machine = Y` | `Pilih mesin` |
| 8 | `Machine_ID` ada di `Master Machine` | `Mesin ini tidak terdaftar` |
| 9 | `Vendor_ID` wajib bila `Need_Vendor = Y` | `Pilih vendor` |
| 10 | `Vendor_ID` ada di `Master Vendor` | `Vendor ini tidak terdaftar` |
| 11 | `Order_ID` wajib bila `Need_Order = Y` | `Buat order dulu` |
| 12 | `Order_ID` ada di `Regrind Orders` | `Order ini tidak ditemukan` |
| 13 | Vendor cocok dengan vendor di order | `Order ini milik vendor lain` |
| 14 | Mesin terpetakan ke alat | `Alat ini tidak dipakai di mesin tersebut` |
| 15 | Tanggal tidak di masa depan | `Tanggal tidak boleh melebihi hari ini` |
| 16 | Tanggal ≥ event sebelumnya | `Tanggal lebih awal dari kejadian sebelumnya` |

Semua pesan dalam Bahasa Indonesia,aktif, dan menyebut jalan keluarnya.

**Dua lapis:**
1. **Sisi klien** — cegah sebelum kirim (ringan, responsif)
2. **Sisi server** — validasi ulang sebelum tulis (penjamin). Kalau gagal,
   kembalikan `{ok:false, pesan, baris}` dan **jangan tulis apa pun**.

---

## 8. Aturan Keselamatan Tulis (dari hari ini)

Semua ini adalah pelajaran dari insiden nyata, dan **wajib jadi guard di server**:

| # | Aturan | Kenapa |
|---|---|---|
| S1 | Tulis kolom input saja | Menulis `''` ke kolom rumus menghapus validasi |
| S2 | Tanggal **harus** nilai date asli | Tanggal teks membuat SS/ROP selalu 1 |
| S3 | Satu baris = satu operasi, dengan `LockService` | Cegah tabrakan tulis |
| S4 | Tulis hanya baris kosong | Jangan menimpa riwayat |
| S5 | **Jangan pernah** `findReplace` range lokal | `$A$2:$A$73` ikut mengenai sheet lain → `#VALUE!` |
| S6 | Perbesar grid + isi rumus **secara berpasangan** | Grid besar saja tidak cukup |
| S7 | `String.replace` pakai **replacer function** | `'$1000'` jadi `$73000` (backreference `$1`) |
| S8 | Pindai **seluruh** workbook setelah menulis | Kerusakan muncul di tempat tak tersentuh |
| S9 | Setiap respons server membawa `stempelVersi` | Kalau baris bergeser, mismatch terdeteksi |

---

## 9. Desain

Tema yang diminta: **biru putih cerah**. Yang saya tolak adalah default —
kartu KPI besar dengan gradien, Inter + serif, dan dasbor bertumpuk kotak.

### 9.1 Konsep

**"Panel Instrumen"** — aplikasi ini terasa seperti alat ukur presisi, bukan
dasbor web. Alasannya ada di subjek: yang diukur adalah *keausan bilah* dan
*umur di vendor*, dua hal yang cara kerjanya persis seperti pengukur.

Dari situ dua keputusan yang tidak bisa datang dari template:

1. **Warna = status toleransi**, bukan dekorasi. Hijau = masih dalam
   toleransi, kuning = satu langkah dari batas, merah = di luar batas. Warna
   itu dipakai hanya untuk itu. Tidak ada warna untuk hiasan.
2. **Skala nonius** sebagai elemen tanda tangan — tanda bertanda tetap, bukan
   progress bar. (lihat §9.5)

### 9.2 Palet

| Token | Hex | Peran |
|---|---|---|
| `lembar` | `#FFFFFF` | Dasar — kertas/pelat, putih bersih (bukan krem) |
| `panel` | `#EEF3FB` | Badan instrumen, latar kartu |
| `tinta` | `#0B2E6F` | Biru pekat — teks, garis, tanda |
| `biru-hidup` | `#1565F0` | Aksi aktif, fokus, keadaan terpilih |
| `gauge-aman` | `#00897B` | Dalam toleransi |
| `gauge-dekat` | `#E8A020` | Mendekati batas |
| `gauge-luar` | `#D64545` | Di luar batas / scrap |

Semua warna diuji di atas rasio kontras 4.5:1 untuk teks; status conveyed
**oleh teks + bentuk**, bukan hanya warna (aman untuk buta warna).

### 9.3 Tipografi

| Peran | Face | Pemakaian |
|---|---|---|
| Display | **IBM Plex Sans Condensed** 600/700, uppercase, tracking rapat | judul panel, label status, angka besar |
| Body | **IBM Plex Sans** 400/500 | paragraf, label form, tombol |
| Data | **IBM Plex Mono** 500 | `Unit_ID`, `Ident_Nr`, nomor ticket, angka tabel |

**Kenapa IBM Plex:** typeface ini dibuat untuk lini produk teknis sebuah
perusahaan rekayasa — karakternya sedikit mekanis dan terukur, bukan generik.
Bukan kebetulan: alat ukur memang punya huruf yang begitu. Dan `Mono` untuk
identifier membuat kode yang ditempa di badan bilah terasa memang seperti kode
yang ditempa.

Skala: `11 / 12 / 13 / 15 / 18 / 22 / 30 / 44 px` · line-height 1.45 body,
1.15 display · angka tabular di semua tabel.

### 9.4 Tata Letak

```
OPERATOR (mobile)                 ADMIN (desktop)
┌──────────────────┐              ┌────────────────────────────────────────┐
│ ▓ status bar    │              │ ▓ sidebar   │  ▓ work queue          │
├──────────────────┤              │  Tiket      │  ┌──────────────────┐  │
│  KARTU ALAT      │              │  Order      │  │ Antrean Tiket    │  │
│  (kartu penuh)   │              │  Movements  │  │ TRG-2026-0042 ● │  │
│                  │              │  Stok       │  │ … (filter chips)│  │
│  ▓▓▓▓░░░░ skala  │              │  Master     │  └──────────────────┘  │
│                  │              │             │  │ Detail + aksi   │  │
│  [ Ajukan asah ] │              │             │  └──────────────────┘  │
└──────────────────┘              └────────────────────────────────────────┘
```

Operator: **satu kolom**, tidak ada sidebar, tidak ada menu. Satu tugas per
layar. Tombol aksi menempel di bawah (jangkauan ibu jari).

Admin: dua kolom — navigasi tetap di kiri (72px, ikon + teks), konten di kanan.

### 9.5 Elemen Tanda Tangan — **Skala Nonius**

Bukan progress bar. Sebuah garis bertanda tetap dengan indeks yang bergerak,
seperti skala pengukur:

```
  sudah asah   0 ─┬────┬────┬────┬────┬─ 4   batas
                  1    2    3    4
               └──────────────────┘
                    ▲ indeks = Life_No
```

- Jarak tanda **bermakna**: satu tanda = satu kali asah
- **Amber** saat indeks di `maks-1`, **merah** saat `≥ maks`
- Dipakai untuk: keausan alat, level stok, umur tiket, umur di vendor

**Risiko yang saya ambil:** komponen ini tidak lazim, butuh SVG khusus, dan bisa
terbaca berlebihan kalau dipakai berlebihan. Justifikasinya — angka "sudah asah
2 dari 4" adalah informasi paling khas di seluruh sistem ini, dan progress bar
biasa tidak bisa menyatakan "satu langkah lagi ke batas" secara visual.

### 9.6 Gerak

Sedikit, dan hanya di tempat yang berarti:

| Tempat | Gerak | Kenapa |
|---|---|---|
| Scan berhasil | kartu alat *fade + slide* masuk, 180ms | memberi kepastian "terbaca" |
| Skala nonius | indeks *bergeser* ke posisi baru, 240ms | menunjukkan perubahan angka |
| TiketBaru | badge berdenyut sekali | menarik perhatian tanpa noisy |
| Halaman | tanpa animasi | cukup |

Semua hilang saat `prefers-reduced-motion: reduce`.

### 9.7 Bahasa Antarmuka

Kata yang dipakai user, bukan kata yang dipakai sistem.

| situation | Tulisan |
|---|---|
| Tombol | `Ajukan pengasahan` · `Setujui & pilih unit` · `Kirim ke vendor` · `Terima kembali` |
| Toast | `Pengajuan terkirim · TRG-2026-0042` |
| Galat | `Unit ini belum terdaftar di master. Hubungi admin gudang.` |
| Kosong | `Belum ada tiket menunggu. Bagus.` |
| Field | `Mesin` · `Jumlah unit` · `Kondisi` · `Foto alat` |

Tidak ada "Submit", "Data", "Record", "Success". Tidak ada kalimat yang
meminta maaf. Galat selalu menyebut apa yang terjadi **dan** apa yang harus
dilakukan.

---

## 10. Peta Jalan

| Fase | Isi | Selesai bila |
|---|---|---|
| **F0** Persiapan | Sheet `Master User`, whitelist 3 email uji, sitemap | 3 akun masuk & terlihat berbeda |
| **F1** Kerangka | Auth, router peran, tokens, shell PWA | 3 peran melihat kerangka kosongnya |
| **F2** Kartu Alat | Scan/ketik, riwayat, skala nonius | Operator bisa scan & lihat |
| **F3** Pengajuan | Form + foto + validasi + antre offline | Tiket sampai ke admin |
| **F4** Antrean Admin | Verifikasi, pilih unit, order, kirim, terima | Satu siklus penuh tertutup |
| **F5** Movements | Semua activity, validasi penuh, guard S1–S9 | 0 baris `Err_Flag` dari aplikasi |
| **F6** Dashboard SPV | Ringkasan, aging, vendor SLA | SPV bisa jawab "ada yang merah?" |
| **F7** Master | CRUD + health check terjadwal | Admin bisa tambah alat & mesin |
| **F8** Penguatan | Audit log, uji beban, offline penuh, a11y | Lolos uji; `cek-kesehatan.mjs` tetap SEHAT |

**Estimasi:** F0–F3 ≈ 2 minggu, F4–F6 ≈ 3 minggu, F7–F8 ≈ 2 minggu.

---

## 11. Risiko & Mitigasi

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R1 | Apps Script kuota 6 menit/hari | Muka saat dipakai banyak | Batch read, cache referensi 5 menit, satu bundle per layar |
| R2 | Dua orang tulis baris sama | Data kacau | `LockService` + tulis hanya baris kosong + cek versi |
| R3 | Sinyal buruk di mesin | Operator tak bisa ajukan | Antre offline + IndexedDB + kirim ulang otomatis |
| R4 | Foto besar | Kuota Drive | Kompres sisi klien ke ≤150 KB sebelum unggah |
| R5 | Column bergeser karena ada yang insert baris | Akses data salah | Jangan pernah insert baris produksi; pakai `extendSheet` |
| R6 | Aplikasi menulis ke kolom rumus | Validasi hilang | Repositori hanya boleh menulis kolom putih yang daftarnya eksplisit |
| R7 | Struktur spreadsheet berubah | Aplikasi rusak diam-diam | `healthCheck()` harian; gagal → spanduk di aplikasi |
| R8 | Admin salah pilih unit | Log tidak sinkron | Kunci unit saat tiket disetujui; unit terkunci tidak bisa dipilih lagi |

---

## 12. Kriteria "Selesai"

Aplikasi dianggap selesai bila:

- [ ] Semua 3 peran menjalankan alurnya **tanpa membuka Spreadsheet**
- [ ] **0 baris** dengan `Err_Flag = 1` berasal dari aplikasi
- [ ] Siklus penuh tertutup: scan → ajukan → pilih unit → kirim → terima → kembali
- [ ] `cek-kesehatan.mjs` → **SEHAT** setelah dipakai seminggu
- [ ] Jalan di HP 360 px & desktop 1440 px
- [ ] Semua kontrol punya fokus keyboard yang terlihat
- [ ] `prefers-reduced-motion` dihormati
- [ ] Tidak ada satu pun warna yang hanya membawa informasi

---

## 13. Keputusan & Alternatif yang Ditolak

> **Keputusan:** backend Apps Script `.gs`, frontend PWA vanilla tanpa bundler.
> **Bukti:** 3 penulis konkuren butuh locking; `Session.getActiveUser()` adalah
> cara paling murah enforcing peran; repo sudah memakai `.gs` + `clasp`.
> **Alternatif ditolak:** Sheets API langsung dari browser — perlu OAuth client
> di PWA, token refresh merepotkan, dan tidak ada locking. React + Vite — tidak
> menambah nilai untuk 8 layar yang relatif stabil.
> **Akibat/risiko:** kuota Apps Script; sudah dimitigasi R1.
> **Rollback:** frontend statis bisa dilepas dari hosting; backend diturunkan via
> `clasp` tanpa menyentuh data.

---

> **Langkah berikutnya:** izinkan saya mulai **F0–F1** (kerangka + peran).
> Itu tidak menyentuh data produksi selain menambah sheet `Master User`.
> Semua fase berikutnya saya kerjakan di sandbox lebih dulu.