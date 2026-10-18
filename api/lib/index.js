/* Pintu masuk tunggal untuk semua endpoint: const { ... } = require("./_lib").
   Dulu satu file _lib.js (646 baris); sekarang dipecah per tanggung jawab:
     config   mode pembayaran dan kunci Midtrans
     store    penyimpanan kunci-nilai (Supabase / file lokal)
     security hash, ID acak, rahasia pesanan, pembatas percobaan
     session  login admin dan cookie sesi
     http     kerangka handler (HttpError, handle, allow, requireAdmin, ...)
     catalog  menu, stok, kategori ditutup
     tables   meja dan kode QR
     orders   pesanan: antrian langsung dan arsip permanen
     payment  Midtrans */
const store = require("./store");

module.exports = {
  ...require("./config"),
  ...require("./store"),
  ...require("./security"),
  ...require("./session"),
  ...require("./http"),
  ...require("./catalog"),
  ...require("./tables"),
  ...require("./orders"),
  ...require("./payment"),
  redis: store.kv, // nama lama untuk kv(), dipertahankan untuk kode lain yang belum dipindah
};
