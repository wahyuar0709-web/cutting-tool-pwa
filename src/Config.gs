/**
 * Config.gs — konstanta tunggal untuk seluruh aplikasi.
 * Tidak ada magic number di file lain.
 */
const CONFIG = {
  /**
   * Stempel build. NAIKKAN setiap kali kode didorong.
   * Aksi `ping` mengembalikannya, sehingga kita bisa memastikan versi mana
   * yang benar-benar hidup di deployment — tanpa menebak.
   */
  BUILD: '2026-10-12-02',

  SPREADSHEET_ID: '1TQd2aUErMypDsrlbKaos1j8WHha_FqX5F7fXlgglhN0',

  /**
   * Client ID Google OAuth. WAJIB sama dengan CLIENT_ID di
   * web/js/konfigurasi.js — backend memverifikasi klaim `aud` pada token ID,
   * jadi kalau tidak sama, semua permintaan ditolak "Token audience mismatch".
   */
  CLIENT_ID: '295783259439-da4h29qv4jual9kmth94gb1akv5jhb2j.apps.googleusercontent.com',

  APP_NAME: 'Monitoring Cutting Tool',
  TIMEZONE: 'Asia/Jakarta',

  // lama cache referensi (detik). Master jarang berubah.
  CACHE_TTL: 300,

  // batas aman sebelum sheet dianggap perlu diperbesar
  MIN_ROW_FREE: 300,

  SHEETS: {
    DASHBOARD: 'DASHBOARD',
    STOCK: 'Stock Overview',
    UNIT_STATUS: 'Unit Status Report',
    VENDOR_PERF: 'Vendor Performance',

    M_USER: 'Master User',
    M_TOOL: 'Master Tool',
    M_TOOL_UNIT: 'Master Tool Unit',
    M_TOOL_MACHINE: 'Master Tool Machine',
    M_MACHINE: 'Master Machine',
    M_VENDOR: 'Master Vendor',
    M_ACTIVITY: 'Master Activity Type',
    M_STATUS: 'Master Status Code',
    M_CONFIG: 'Master Configuration',
    MASTER_DATA_AUDIT: 'Master Data Audit',

    REQ: 'Regrind Requests',
    ORD: 'Regrind Orders',
    MOV: 'Tool Movements',
  },

  /**
   * Kolom INPUT per sheet. Aplikasi WAJIB hanya menulis kolom ini.
   * Kolom di sebelah kanannya milik rumus Sheets dan tidak boleh disentuh.
   * Aturan S1: menulis string kosong ke kolom rumus akan menghapus validasi.
   */
  INPUT_COLUMNS: {
    'Tool Movements': ['Tanggal', 'Date_Source', 'Unit_ID (input)', 'Activity', 'Machine_ID', 'Vendor_ID', 'Order_ID', 'PIC', 'Reference_ID (tiket)', 'Source', 'Remark'],
    'Regrind Orders': ['Order_ID', 'Vendor_ID', 'Tgl_PR', 'Tgl_BC', 'No_SJ', 'Biaya_Total', 'Catatan', 'Qty_Kirim'],
    'Regrind Requests': ['Ticket_ID', 'Tanggal', 'Operator', 'Machine_ID', 'Tool_Code', 'Qty', 'Kondisi', 'Aktual_Pemakaian', 'Catatan / Ident', 'Foto_URL'],
    'Master Tool': ['Tool_Code', 'Tool_Name', 'Brand', 'Tool_Type', 'Material', 'Specification', 'UOM', 'Weight_kg', 'Default_Vendor_ID', 'Default_Rack', 'Max_Regrind', 'Unit_Price', 'Regrind_Cost', 'Active (Y/N)'],
    'Master Tool Unit': ['Unit_ID', 'Tool_Code', 'Ident_Nr', 'Tool_ID', 'Tanggal_Masuk', 'Opening_Status', 'Opening_Regrind', 'Opening_Machine', 'Opening_Date', 'Source (NEW/OPENING_BALANCE)', 'Catatan'],
  },

  ROLES: { ADMIN: 'ADMIN', OPERATOR: 'OPERATOR', SPV: 'SPV' },

  // hak akses per peran. dippingakai oleh Main.gs dan Router.
  IZIN: {
    ADMIN: ['dashboard', 'stok', 'kartu', 'tiket.buat', 'tiket.lihat', 'tiket.verifikasi', 'order', 'movement', 'master', 'ekspor'],
    OPERATOR: ['dashboard', 'stok', 'kartu', 'tiket.buat', 'tiket.lihat'],
    SPV: ['dashboard', 'stok', 'kartu', 'tiket.lihat', 'ekspor'],
  },
};