# Qahwa: pesan dan bayar QRIS

## Mode pembayaran (PAYMENT_MODE)
- `mock`: simulasi penuh tanpa Midtrans. Tombol "Simulasikan bayar" muncul di halaman status. Default.
- `sandbox`: Midtrans uji (kunci diawali `SB-`). Pakai simulator pembayaran Midtrans Sandbox.
- `production`: uang sungguhan. Server menolak jika kunci masih kunci sandbox.
Endpoint `/api/mockpay` hanya ada saat mode `mock`.

## Coba di komputer (tanpa Redis, tanpa akun Midtrans)
1. Salin `.env.example` jadi `.env`. Untuk uji lokal, `ADMIN_PASSWORD=admin123` sudah cukup. Untuk sandi sungguhan: `node scripts/hash-password.js "kalimat sandi panjang"` lalu tempel hasilnya ke `ADMIN_PASSWORD_HASH`.
2. `node scripts/dev.js`. Terminal menampilkan apakah `.env` terbaca dan apakah login admin siap. Setiap kali `.env` diubah, jalankan ulang server.
3. Buka http://localhost:3000/admin, masuk, buka tab **Meja & QR**, atur jumlah meja. Setelah itu scan atau buka salah satu QR untuk melihat sisi pelanggan.
Data lokal (termasuk daftar meja dan kode QR) hilang saat server dimatikan, jadi QR yang sudah dicetak hanya berlaku selama server yang sama jalan. Di Vercel dengan Redis, datanya tetap.

## Sistem meja otomatis
- Pemilik mengatur jumlah meja di **Admin > Meja & QR** (1 sampai 60, ditambah opsi QR "Bawa pulang"), lalu menekan **Cetak QR** dan menempel satu QR di tiap meja.
- Setiap QR berisi alamat `https://DOMAIN/?m=KODE`, dengan KODE acak 8 karakter milik meja itu. Pelanggan yang scan langsung disambut "Selamat datang, pelanggan Meja N", tidak ada pilihan meja, dan pesanan masuk dapur dengan nomor mejanya.
- Meja ditentukan server dari KODE, bukan dari isian pelanggan, jadi tidak bisa dipalsukan dengan mengubah alamat. Daftar kode hanya bisa dilihat admin.
- Menambah jumlah meja tidak mengubah QR yang sudah dicetak. Mengurangi jumlah membuat QR meja yang dihapus tidak berlaku lagi (ada konfirmasi).
- Halaman tanpa QR atau dengan QR yang tidak dikenal tetap bisa melihat menu, tetapi tombol bayar nonaktif.
- Saat mencetak QR di komputer sendiri, ubah kolom "Alamat situs di dalam QR" menjadi alamat yang bisa dibuka HP, misalnya `http://192.168.1.5:3000`. Di Vercel kolom itu sudah benar sendiri.
- `/qr` sekarang hanya mengalihkan ke tab Meja & QR di admin, karena QR berisi kode yang tidak boleh terlihat publik.

## Deploy ke Vercel
1. Import proyek, tambah integrasi Upstash Redis (Storage).
2. Isi Environment Variables: `PAYMENT_MODE`, `ADMIN_PASSWORD_HASH`, dan untuk sandbox/production `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`.
3. Di dashboard Midtrans, isi Payment Notification URL: `https://DOMAIN-KAMU/api/notify`.
4. Buka `https://DOMAIN-KAMU/admin`.

## Keamanan yang sudah ada
- `ADMIN_PASSWORD` (polos) hanya berlaku di komputer lokal. Di Vercel dan di mode production diabaikan; wajib `ADMIN_PASSWORD_HASH`.
- Login admin: password di-hash (scrypt), maksimal 5 percobaan per 15 menit per IP, sesi acak 8 jam di server, cookie HttpOnly + Secure + SameSite=Strict, tombol Keluar mencabut sesi.
- Semua aksi tulis dicek asalnya (anti CSRF), status pesanan hanya maju satu langkah, harga selalu dari server, ID pesanan acak kriptografis.
- Webhook Midtrans diverifikasi tanda tangan dan nominalnya. Header CSP, HSTS, anti-frame ada di `vercel.json`.
- Halaman pelanggan tidak punya tautan atau kode admin; `/admin` tidak diindeks mesin pencari.
Sebelum production: ganti password, aktifkan 2FA akun Vercel dan Midtrans, jangan commit file `.env`.

## Tampilan
- Tema putih, gaya 3D (tombol bertebal, kartu timbul, kartu menu miring mengikuti kursor, transisi balik halaman).
- Layar pembuka 3D (`public/intro.js` + three.js lokal di `public/vendor/`) tampil dulu sebelum menu. Cangkir bisa diputar dengan geser. Jika WebGL tidak ada atau gagal dimuat, otomatis tampil versi CSS.
- Semua gaya ada di `public/ds.css`; ubah token di bagian `:root` untuk mengganti warna.
