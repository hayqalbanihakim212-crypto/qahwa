# Refactor Qahwa

## Cara memasang
1. Salin isi `api/` ke folder `api/` proyek. **Hapus `api/_lib.js` lama**: file itu akan menutupi folder `api/_lib/` yang baru.
2. `admin_1.js` sekarang menjadi `api/admin.js`.
3. Salin `public/` (ada dua file baru: `common.js`, `home.js`). Folder `vendor/` tidak berubah.
4. Hapus `supabase_orders.sql`: isinya sudah ada di `supabase.sql`.

## Struktur API
`_lib.js` (646 baris) dipecah menjadi `api/_lib/`. Semua handler tetap memakai `require("./_lib")`.

| Modul | Isi |
|---|---|
| `config` | mode pembayaran, kunci Midtrans |
| `store` | penyimpanan kunci-nilai (Supabase / file lokal). `redis()` kini `kv()`; nama lama masih diekspor |
| `security` | hash, ID acak, rahasia pesanan, pembatas percobaan |
| `session` | login admin dan cookie sesi |
| `http` | `handle`, `HttpError`, `allow`, `requireAdmin`, `requireSameOrigin`, `rateLimit` |
| `catalog` | menu, stok, kategori ditutup |
| `tables` | meja dan kode QR |
| `orders` | pesanan (antrian langsung + arsip) |
| `payment` | Midtrans (buat transaksi, cek status, verifikasi notifikasi) |

Semua handler sekarang memakai `handle()`: error HTTP lewat `throw new HttpError(409, "dupe")`, satu `try/catch` untuk semua. `order.js` dipecah jadi `readOrder`, `priceItems`, `placeOrder`; `stock.js` jadi satu fungsi per aksi (`addItem`, `editItem`, `deleteItem`, `toggleStock`, `toggleCategories`).

## Perubahan perilaku (disengaja)
- **Keranjang kosong ditolak** (`400 empty`). Dulu `POST /api/order` dengan keranjang kosong atau semua baris tidak valid tetap membuat pesanan Rp 0 (mode mock langsung lolos). Pesan error di `app.js` sekarang dipilih dari kode error server, bukan dari status HTTP.
- Semua endpoint kini mencatat error 500 ke log (dulu sebagian diam).

## Frontend
- `common.js` baru: `$`, `rp`, `esc`, `TAKE`, `tl`, `stepsHtml` (dulu ditulis dua kali di `app.js` dan `admin.js`). Dimuat sebelum `app.js` / `admin.js`.
- `admin.js`: helper `sessionLost()` menggantikan 8 salinan penanganan sesi habis, `flash()` untuk pesan sukses/gagal, `RANGE_DAYS` satu tempat.
- Dibuang karena tidak dipakai markup mana pun: efek miring kartu menu (`.m`, `.ph`, `.pr`, `.grid`, `.ar`), `.tags`, `.home .cover`, tombol panah carousel.
- CSS: aturan ganda di `ds.css`/`theme.css`/`admin.css` digabung (`.intro`, `.stage`, blok layar sentuh, `.srow`, `html/body`).
- `home.html`: skrip carousel dipindah ke `home.js`.

## SQL
`supabase_menu.sql` kini dihasilkan dari `_menu.js` (`node scripts/gen-menu-sql.js`), jadi menu punya satu sumber.

**Perlu keputusan Anda.** Seed lama dan `_menu.js` berbeda:
- Nama kategori: `Besides Coffee`/`Soft Based Drinks`, `Mocktail`/`Based Soda`, `Crispy`/`Snack`.
- 8 menu (Roti Bakar, Burgers) hanya ada di `_menu.js`.

Seed baru memakai nama dari `_menu.js` (sama dengan `FOOD_BASE` di `admin.js`). Kalau database Anda dulu diisi dari seed lama, kategori `Crispy` dianggap **minuman** oleh tab Stok, sehingga "Tutup semua makanan" melewatinya. Perbaikannya:
```sql
update menu_items set c = 'Snack' where c = 'Crispy';
```
(Ubah juga dua nama lain kalau mau seragam. Menu 123 sampai 130 baru masuk setelah seed baru dijalankan.)

## Pengujian
- **API**: kode lama dan baru dijalankan dengan 78 langkah skenario identik (login, meja, order, mockpay, antrian, semua aksi stok, pembatas login). Hasilnya sama, kecuali dua langkah keranjang kosong di atas.
- **Frontend**: halaman pelanggan dan admin dirender di DOM tiruan (jsdom) dengan data yang sama; HTML hasil render lama dan baru identik untuk menu, checkout, status pesanan, antrian, statistik, riwayat, stok, dan QR meja.
- **Belum teruji**: Supabase dan Midtrans sungguhan (API diuji dalam mode lokal/mock), tampilan CSS di browser (hanya dicek per aturan), `intro.js`/three.js, dan ekspor PDF.

## Belum dikerjakan
- Menggabung `ds.css` dan `theme.css` jadi satu tema gelap (perlu cek visual).
- Memecah `admin.js` (1.028 baris) jadi modul ES.
- `FOOD_BASE` di `admin.js` masih daftar tulisan tangan; sebaiknya dari server.
- `POST /api/admin` membaca lalu menulis pesanan tanpa kunci, jadi dua staf yang menekan tombol bersamaan bisa saling menimpa.
- Setiap toggle stok menulis ulang seluruh tabel `menu_items`.
