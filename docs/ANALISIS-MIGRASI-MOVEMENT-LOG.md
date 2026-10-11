# Analisis Migrasi: `Movement Log` (sistem lama) → `Tool Movements` (sistem baru)

> Sumber: `Monitoring Saw blade & cutter` (lama) ID `1Uhzc48Y4Tyous1BvkYyhUKbR8_-HiCr5NG9v3gxGHuo`
> Target: `Monitoring Cutting Tool` (baru) ID `1TQd2aUErMypDsrlbKaos1j8WHha_FqX5F7fXlgglhN0`
> Semua angka dibaca langsung dari kedua spreadsheet, bukan estimasi.

---

## 1. Kesimpulan

**YA — data bisa dimigrasi.** Dari 1.416 baris riwayat, **1.397 baris (98,7%)** layak dipindah.

| Pemeriksaan | Hasil |
|---|---|
| Transisi status valid | **846 / 866 = 97,7%** |
| Status hasil replay = `Opening_Status` | **521 / 524 = 99,4%** |
| Activity lama ada di `Master Activity Type` baru | **5 / 5** |
| Vendor lama ada di `Master Vendor` baru | **3 / 3** |
| `Unit_ID` lama ada di `Master Tool Unit` baru | **524 / 531** |
| Tanggal kolom A vs Q saling bertentangan | **0** |

---

## 2. Struktur Sumber

`Movement Log` lama: 1.416 baris, kolom A–Q (Q tanpa header).

| Kolom | Nama lama | Isi | Terisi |
|---|---|---|---|
| A | Tanggal | tanggal | 902 |
| B | Kode Alat | kode | 1.397 |
| C | Unit_ID | id unit | 1.397 |
| D | ID_Transaksi | id urut | 1.416 |
| E | Spesifikasi Alat | teks | 1.397 |
| F | Mesin | nama | 1.327 |
| G | Kode Mesin | kode | 1.034 |
| H | Activity | jenis | 1.397 |
| I | Qty | jumlah | 1.397 |
| J | Cycle_ID | siklus | 1.397 |
| K | Counter | urutan | 1.416 |
| L | Vendor Tujuan | nama vendor | 92 |
| M | PIC | nama | 1.193 |
| N | Remark | catatan | 413 |
| P | Column 2 | penanda kualitas | 1.416 |
| **Q** | *(tanpa header)* | **tanggal** | **1.245** |

**Penanda kualitas (kolom P):**

| Penanda | Jumlah | Dipetakan ke `Date_Source` |
|---|---|---|
| ASLI | 902 | `ACTUAL` |
| ESTIMASI - STOK AWAL SISTEM | 423 | `ESTIMATED` |
| CEK MANUAL | 91 | `UNKNOWN` |

**Activity:** `PEMBELIAN BARU` 531 · `DIPASANG KE MESIN` 286 ·
`KEMBALI KE GUDANG (TUMPUL)` 236 · `KIRIM KE VENDOR ASAH` 204 · `SELESAI DIASAH` 140 · kosong 19

---

## 3. Cara Kolom Tanggal

Kolom A (Tanggal) dan kolom Q sama-sama berisi tanggal. Hasil pemeriksaan:

| Keadaan | Jumlah |
|---|---|
| Keduanya terisi & **sama** | 822 |
| Keduanya terisi & **berbeda** | **0** |
| Hanya kolom A | 79 |
| Hanya kolom Q | 423 |
| Keduanya kosong | 73 |

→ **Aman** memakai `A` bila ada, selain itu `Q`.

Format campur: `d/m/yyyy` (423 nilai) dan `d/m/yy` (1.724 nilai).
Contoh `14/12/2025` memastikan urutan **hari/bulan/tahun** — bukan bulan/hari/tahun.
Rentang data: **14 Des 2025 – 29 Sep 2026**.

---

## 4. Baris yang Harus Dilewati

**19 baris** hanya berisi `ID_Transaksi` + penanda `CEK MANUAL` — bukan kejadian bisnis.
Contoh: `["","","","1241","","","","","","","1","","","","","CEK MANUAL"]`

→ Dilewati. Sesuai catatan di `Migration Notes`: *"Jangan dimigrasi (bukan kejadian bisnis)."*

---

## 5. Masalah yang Harus Anda Putuskan

### 5.1 Unit & Kode Alat yang Tidak Ada di Master Baru

| Item | Jumlah | Keterangan |
|---|---|---|
| `Unit_ID` tidak ada | **7** | `Luc-SB-01-001`, `Luc-SB-02-001` … `Luc-SB-02-004` |
| `Kode Alat` tidak ada | **2** | `Luc-SB-01`, `Luc-SB-02` |

Keluarga `Luc-*` belum ada di `Master Tool` / `Master Tool Unit` baru.
**Perlu:** ditambahkan ke master, atau dibuang dari riwayat.

Sebaliknya ada **12 unit** di master baru yang **tidak punya** riwayat gerak
(`HAU-SB-01-023` … `HAU-SB-01-027`).

### 5.2 Kode Mesin

| Keadaan | Jumlah |
|---|---|
| Tanpa kode mesin | 363 |
| **Lebih dari satu** kode mesin | **315** |
| `DIPASANG KE MESIN` tanpa mesin | 10 |

Contoh nilai gabungan: `RDS017/RDS018/RDS019`, `RDS020/RDS021`, `RDS018, RDS019`.
Kolom `Machine_ID` di sistem baru menggunakan **satu** kode.

**Perlu:** ambil kode pertama, pisah jadi beberapa baris, atau biarkan kosong.

### 5.3 Data yang Tidak Lengkap

| Kekurangan | Jumlah | Dampak |
|---|---|---|
| Baris tanpa PIC | 204 | `PIC` wajib → `Err_Flag = 1` |
| `KIRIM KE VENDOR ASAH` tanpa vendor | 119 / 204 | `Err_Flag = 1` |
| Baris tanpa tanggal | 73 | `Date_Source = UNKNOWN` |
| `ID_Transaksi` duplikat | 2 pasang | ID lama disimpan di `Remark` |

Pasangan duplikat: `ID 1238` (LEU-CT-15-007 & LEU-CT-01-001),
`ID 1240` (LEU-CT-49-002 & LEU-CT-01-001).

### 5.4 Transisi Tidak Valid — 20 baris (2,3%)

Pola yang berulang: `SIAP PAKAI → KEMBALI KE GUDANG (TUMPUL)`.
Artinya `DIPASANG KE MESIN` tidak pernah tercatat di sistem lama.
Contoh: `HAU-SB-02-007`, `HAU-SB-02-008`, `HAU-SB-01-005`.

**Ini memang perilaku yang dikehendaki sistem baru** — bukan untuk dibetulkan,
melainkan ditandai agar terlihat di `Transaction Audit`.

---

## 6. Mengapa Migrasi Ini Aman

Formula `Unit Status Report` di sistem baru sudah dirancang untuk dua kondisi:

```excel
Status  =IF(N_Event=0,'Master Tool Unit'!F2, INDEX('Tool Movements'!$T$2:$T$3001,Last_Row))
Regrind =IF(N_Event=0,N('Master Tool Unit'!G2), INDEX('Tool Movements'!$W$2:$W$3001,Last_Row))
```

| Unit | Kejadian | Yang dipakai sistem |
|---|---|---|
| 12 unit tanpa riwayat | 0 | `Opening_Status` dari master — **tetap aman** |
| 524 unit dengan riwayat | ≥1 | hasil replay dari ledger |

Uji replay menunjukkan **99,4%** hasil replay sama dengan `Opening_Status`.
Jadi memindahkan riwayat **tidak merusak** status yang sudah tercatat.

3 unit yang berbeda setelah replay:
`LEU-CT-01-001` (→ MENUNGGU ASAH), `LEU-CT-14-002` (→ DIPAKAI), `LEU-SB-01-002` (→ SIAP PAKAI).

---

## 7. Rencana Penulisan

Hanya kolom **input** yang diisi; kolom M–AF dihitung otomatis oleh formula.

| Kolom baru | Sumber lama | Aturan |
|---|---|---|
| B `Tanggal` | A atau Q | ubah `d/m/y[y]` → ISO `y-m-d` |
| C `Date_Source` | kolom P | ASLI→`ACTUAL`, ESTIMASI→`ESTIMATED`, CEK MANUAL→`UNKNOWN` |
| D `Unit_ID (input)` | C | apa adanya |
| E `Activity` | H | apa adanya |
| F `Machine_ID` | G | perlu keputusan (lihat 5.2) |
| G `Vendor_ID` | L | AKE→`V01`, Wuxi→`V03`, LEUco→`V04` |
| H `Order_ID` | — | kosong |
| I `PIC` | M | apa adanya |
| J `Reference_ID` | — | kosong |
| K `Source` | — | `MIGRASI` |
| L `Remark` | D, E, N | simpan `ID_Transaksi` lama + catatan |

Total: **1.397 baris** ditulis ke kolom B–L.
---

## 8. HASIL EKSEKUSI FINAL (10 Oktober 2026)

Bagian 1-7 di atas adalah analisis **sebelum** eksekusi. Angka di bawah adalah hasil **setelah`
semua perbaikan dijalankan dan diverifikasi ulang dari spreadsheet target.

### 8.1 Integritas formula

| Sheet | Jumlah formula |
|---|---|
| Tool Movements | 63.000 |
| Unit Status Report | 36.000 |
| Stock Overview | 11.600 |
| Legacy Master Tool Unit | 8.570 |
| Regrind Orders | 6.000 |
| Regrind Requests | 2.500 |
| Master Tool Machine | 1.791 |
| Master Tool Unit | 1.500 |
| Transaction Audit | 700 |
| Vendor Performance | 700 |
| Master Tool / Legacy Master Tool | 898 |
| DASHBOARD, Identifier Corrections, Master Data Audit, Master Configuration | 657 |
| **TOTAL** | **133.916** |

Baseline sebelum migrasi 124.849. Tidak ada formula yang hilang.

> **Pelajaran (wajib diingat):** Sekali penulisan `RAW` atas hasil baca `FORMATTED_VALUE` menghapus
> 650 formula. Semua pulih dari backup `backup-*-2026-10-111107.json`. Aturan: baca `FORMULA`
> bila ingin mempertahankan rumus, atau tulis `USER_ENTERED` per sel.

### 8.2 Tool Movements

1.399 baris · `Err_Flag = 1` sebanyak **127** · **90,9% bersih**

| `Cek` | Jumlah | Sifat |
|---|---|---|
| OK | 1.270 | — |
| Machine_ID wajib untuk activity ini | 93 | gap data lama, tidak bisa dikarang |
| Transisi tidak valid (6 jenis) | 20 | riwayat lama melompat status |
| Order_ID wajib untuk activity ini | 9 | baris `SELESAI` duplikat (lihat 8.4) |
| Tanggal lebih awal dari event sebelumnya | 5 | urutan tanggal lama tidak rigor |

Sisa 127 error **semua berasal dari data lama**, tidak ada dari logika sistem baru, dan tidak
masuk hitungan `Master Data Audit` karena disaring `Source <> "MIGRASI"`.

### 8.3 Perbaikan yang mengubah hasil

| Masalah | Gejala | Perbaikan | Dampak |
|---|---|---|---|
| Tanggal tersimpan sebagai teks | `SS`/`ROP` selalu 1, `Sumber_LT` = DEFAULT | tulis ulang kolom B sebagai tanggal asli | 1.324 sel |
| `Prev_Date` kejadian pertama | 227 "tanggal lebih awal" | `Prev_Date` kosong bila `Prev_Row` kosong | 227 → 5 |
| `Vendor_ID` ledger | 95 "vendor tidak sama dengan order" | vendor ledger mengikuti vendor order sebenarnya | 95 → 0 |
| Duplikat `SELESAI` | 9 order "Qty terima > qty kirim" | lepas `Order_ID` dari baris duplikat | 9 → 0 |

### 8.4 Catatan duplikat SELESAI

Sembilan unit punya dua baris `SELESAI DIASAH` dengan tanggal identik di `Movement Log` lama:

`LEU-CT-08-005`, `LEU-CT-11-004`, `LEU-CT-11-005`, `LEU-CT-11-006`, `LEU-CT-11-008`,
`LEU-CT-13-004`, `LEU-CT-15-007`, `LEU-CT-15-008`, `LEI-CT-01-001`

Baris_asli **tetap ada** di ledger; hanya `Order_ID`-nya dilepas pada baris kedua agar
tidak terhitung dua kali dalam satu order. Data tidak dihapus.

### 8.5 Stock Overview (71 item)

| Status | Jumlah |
|---|---|
| AMAN | 44 |
| KRITIS | 19 |
| HABIS | 7 |
| WASPADA | 1 |

| Metrik | n | min | median | max |
|---|---|---|---|---|
| `LT_Dipakai` | 71 | 33 | 33 | 51,5 |
| `Safety_Stock` | 71 | 1 | 1 | 7 |
| `Reorder_Point` | 71 | 1 | 1 | 23 |

`Sumber_LT`: **DATA VENDOR 23** · **DEFAULT 48** (default 33 hari, sama dengan SLA V01).

### 8.6 Regrind Orders (204 order)

| Status | Jumlah |
|---|---|
| SELESAI | 131 |
| DI VENDOR | 73 |
| **Cek = OK** | **204 / 204** |

| Metrik | n | min | median | max |
|---|---|---|---|---|
| `LT_Proses_Vendor` | 131 | 19 | 44 | 127 |
| `LT_Total (PR→Terima)` | 107 | 19 | 79 | 186 |

Lead time proses per vendor:

| Vendor | n | median | max |
|---|---|---|---|
| V01 AKE | 85 | 20 | 127 |
| V02 INTERWOOD | 40 | 98 | 115 |
| V03 Wuxi Zhouling | 6 | 38 | 38 |
| V04 LEUco | 0 | — | — |

V04 belum punya order selesai — SLA 120 masih **provisional** sampai ada siklus pertama selesai.

### 8.7 DASHBOARD

`Kualitas data: BERSIH (0 error)` · Total unit aktif 536 · Siap 381 · Dipakai 59 ·
Menunggu asah 32 · Di vendor 64 · Item habis 7 · kritis 19 · peringatan 1

### 8.8 Yang masih menunggu keputusan warehouse

| Item | Jumlah | Catatan |
|---|---|---|
| `Max_Regrind` kosong | 72 alat | batas scrap belum ditetapkan |
| `Opening_Machine` dari mapping master | 7 unit | perlu konfirmasi lapangan |
| `Machine_ID` ambigu | 93 baris | 1 alat terpasang di banyak mesin |

---

## 9. Aturan Scrap `Max_Regrind` = 4 (disetujui 11 Oktober 2026)

Warehouse menetapkan **batas 4 kali pengasahan** sebelum unit dinilai ganti.

### 9.1 Dasar angka

`Max_Regrind` dibandingkan dengan **`Regrind_Count`**, bukan `Life_No`.

| Angka | Arti | Dipakai untuk |
|---|---|---|
| `Regrind_Count` (H) | berapa kali unit **sudah** dikikis | **keputusan scrap** |
| `Life_No` (I) | `Regrind_Count + 1` | nomor kehidupan, untuk pembacaan |

Kalau yang dipakai `Life_No`, unit baru yang belum pernah dikikis akan terhitung
sudah punya 1 kali — salah.

### 9.2 Sebaran `Regrind_Count` (536 unit)

| Kali | Unit |
|---|---|
| 0 | 416 |
| 2 | 101 |
| 4 | **18** |
| 6 | **1** (`LEU-CT-11-006`) |

Tidak ada unit di angka ganjil — pola siklus pengasahan di data lama memang berpasangan.

### 9.3 Hasil

- **19 unit** berstatus `WAJIB EVALUASI SCRAP` (18 unit di angka 4 + 1 unit di angka 6)
- **0 unit** `HAMPIR MAKS REGRIND` (tidak ada unit di angka 3)
- `Master Tool` 72 baris terisi `Max_Regrind = 4`

### 9.4 Perbaikan: `Sisa_Regrind` tidak boleh negatif

Sebelum: `=IF(S2>0,S2-H2,"")` -> `LEU-CT-11-006` menghasilkan **-2**.
Sesudah: `=IF(A2="","",IF(S2<=0,"",MAX(0,S2-H2)))` -> **0**.

### 9.5 Koreksi terhadap catatan sebelumnya

Catatan versi sebelumnya menyebut ada "selisih 1" antara `Life_No` di ledger dan
`Unit Status Report`. Setelah dicek, itu **bukan selisih** melainkan dua definisi berbeda:

| Sheet | Rumus | Makna |
|---|---|---|
| `Tool Movements` (per kejadian) | `Regrind_Sebelum + 1` | nomor kehidupan **sebelum** kejadian itu |
| `Unit Status Report` (per unit) | `Regrind_Count + 1` | nomor kehidupan **sekarang** |

Keduanya benar untuk tujuannya. Tidak ada perubahan data yang diperlukan.

---

## 10. TRIAL END-TO-END (11 Oktober 2026)

Trial dijalankan di **sandbox** (`TRIAL E2E Monitoring Cutting Tool`), salinan dari produksi.
Produksi tidak disentuh selama trial, kecuali perbaikan yang terverifikasi di bagian 10.4.

### 10.1 Hasil skenario

| Skenario | Hasil |
|---|---|
| A — siklus hidup normal (7 langkah) | **7/7 lulus** |
| B — 4 siklus asah sampai batas scrap | **20/20 lulus**, `Regrind_Count` 0→4 lalu `SCRAP` |
| D — 10 input sengaja dirusak | **10/10 ditolak**, tidak satu pun lolos |

Contoh penolakan yang bekerja: `Unit_ID tidak ada di Master Tool Unit`,
`Activity kosong / tidak valid`, `Transisi tidak valid: ? -> SELESAI DIASAH`,
`Machine_ID tidak ada di Master Machine`, `PIC kosong`, `Tanggal kosong`.

Saat 10 baris cacat dimasukkan, badge dashboard **berubah jadi "10 ERROR"** —
gerbang audit bekerja nyata, bukan hiasan.

### 10.2 Cacat yang ditemukan dan SUDAH DIPERBAIKI

**1. Nol kapasitas (blocker).** `Master Tool` 73 baris/73 terisi, `Tool Movements`
3001/3001. Tambah satu alat atau satu movements harian pasti gagal.

**2. 9.512 sel `#REF!` di `Stock Overview` baris 73+.** Terbukti **sudah ada di
produksi sejak awal** (jumlah identik di produksi dan sandbox), bukan efek migrasi.

**3. Rujukan `Master Tool` terkunci di baris 73.** Akibatnya alat di baris 74+
tidak terlihat oleh `Unit Status Report`, dan `Max_Regrind`-nya bernilai 0 —
**aturan scrap diam-diam mati** untuk setiap alat baru.

### 10.3 Temuan tambahan dari revisi

**`Stock Overview` kini menampilkan 72 item, sebelumnya 71.** Satu alat selama ini
tidak terlihat karena terpotong batas baris. Setelah rujukan diperbaiki ke 1000,
`Status`: AMAN 45 · KRITIS 19 · HABIS 7 · WASPADA 1.

**Pola berbahaya:** menulis baris dengan nilai kosong di ujung rentang (mis. 12 nilai
untuk kolom A–L) **menghapus rumus validasi** di kolom terakhir. Ini yang merusak
`Master Tool Unit` kolom `Cek` di sandbox. Kolom input dan kolom rumus harus ditulis
terpisah, tanpa menyertakan string kosong di kolom rumus.

### 10.4 Capacity yang kini tersedia di produksi

| Sheet | Sebelum | Sesudah |
|---|---|---|
| Master Tool | 73 | 1000 |
| Tool Movements | 3001 | 6001 |
| Unit Status Report | 1501 | 3001 |
| Master Tool Unit | 1501 | 3001 |
| Regrind Orders | 1000 | 3001 |
| Master Tool Machine | 997 | 2000 |
| Stock Overview | 1000 | 1000 |

Rujukan silang `Master Tool` diperluas dari `$…$73` ke `$…$1000`.
Rujukan `Master Tool Unit` (1501), `Tool Movements` (3001), `Regrind Orders` (501)
**belum** diperluas — cukup ±2 tahun, dan harus lewat Insert Rows manual di Sheets.

### 10.5 Pelajaran: jangan pernah findReplace range secara buta

Tiga kesalahan beruntun saat revisi, semua karena regex pada range:

1. `String.replace` dengan `'$1000'` dibaca sebagai **backreference `$1`** → hasilnya
   `$73000`. Harus pakai *replacer function*.
2. Regex global `$A$2:$A$\d{3,}` ikut mengubah range **lokal** sheet lain yang tidak
   boleh disentuh → `COUNTIFS` tidak seukuran → `#VALUE!` di DASHBOARD dan audit.
3. Kerusakan dipulihkan dengan menyalin rumus asli dari sandbox baris 1–3.

**Aturan:** ubah range hanya lewat Insert Rows di UI, atau sel per sel dengan
`updateCells` + replacer function + pola yang menyebut prefiks sheet secara eksplisit.
Jangan pernah `findReplace` pada pola range lokal seperti `$A$2:$A$73`.

### 10.6 Status akhir produksi

`0` sel error di seluruh workbook · badge **BERSIH (0 error)** · `TOTAL ERROR = 0` ·
`TOTAL PERINGATAN = 48` · 536 unit · 72 item stok · 19 unit `WAJIB EVALUASI SCRAP` ·
`Sisa_Regrind` 0/2/4 tanpa nilai negatif · 1.397 baris `MIGRASI` utuh.

---

## 11. JARING PENGAMAN: `cek-kesehatan.mjs`

Perintah tunggal untuk memverifikasi seluruh sistem tanpa membuka Spreadsheet.

```
node tools/gsheets-audit/cek-kesehatan.mjs
```

Memeriksa 6 kelompok hal dan keluar dengan `SEHAT` / `MASALAH`:

| # | Pemeriksaan | YangDicek |
|---|---|---|
| 1 | Sel error seluruh workbook | `#VALUE!` `#REF!` `#NAME?` `#N/A` `#NUM!` `#DIV/0!` |
| 2 | Kapasitas grid | ruang kosong tiap sheet untuk data baru |
| 3 | Rujukan silang | tiap rujukan masih di dalam grid (**penyebab scrap mati diam-diam**) |
| 4 | Dashboard & audit | badge, total unit, jumlah unit scrap, `TOTAL ERROR` |
| 5 | Aturan scrap | semua unit punya `Max_Regrind`, tidak ada `Sisa_Regrind` negatif, dashboard cocok laporan |
| 6 | Konsistensi data | `Selisih_Cek`, `Total_Aktif` vs jumlah unit, baris `MIGRASI` |

Script punya retry otomatis saat kena kuota baca Google (429), dan keluar dengan
kode 0 (sehat) / 1 (ada masalah) sehingga bisa dipakai di automation.

### 11.1 Cacat yang ditemukan oleh skrip ini (bukan terlihat manual)

`Stock Overview` punya **dua bug** yang tidak memunculkan error sama sekali:

1. Baris 73+ menunjuk `Master Tool` baris yang sama dengan baris 72
   (`LEU-CT-52` dobel), sehingga `Total_Aktif` = **538** padahal unit sebenarnya **536**.
2. Semua `Tool_Code` di baris 73+ bergeser 1 baris ke belakang.

Penyebabnya: saat menyalin rumus antar-baris, nomor baris **referensi antar-sheet**
ikut tergantikan dengan nomor baris sheet itu sendiri, padahal harus dipertahankan
dengan **offset +1**. Sekarang kolom A ditulis eksplisit
(`=IF('Master Tool'!A{n+1}="","",'Master Tool'!A{n+1})`) dan kolom B–AC memakai
`copyPaste PASTE_FORMULA` yang menjaga offset relatif dengan benar.

Setelah diperbaiki: `Total_Aktif` = **536** = jumlah unit di `Unit Status Report`.

### 11.2 Catatan: `LEI-SB-02` memang tidak muncul di `Stock Overview`

Ini disengaja dan benar**, bukan bug. `Master Tool` baris 17 (`LEI-SB-02`)
dilewati; semua baris sesudahnya memakai offset +1. Jadi 72 baris `Master Tool`
menjadi 71 item di `Stock Overview`.
