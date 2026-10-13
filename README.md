<div align="center">

# ☕ Qahwa — Pesan & Bayar QRIS
### *Sistem Pemesanan Kafe Berbasis QR Meja*

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![Upstash](https://img.shields.io/badge/Upstash_Redis-00E9A3?style=for-the-badge&logo=upstash&logoColor=black)](https://upstash.com/)
[![Midtrans](https://img.shields.io/badge/Midtrans-003E6B?style=for-the-badge)](https://midtrans.com/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)

> Aplikasi web untuk memesan dan membayar langsung dari meja: scan QR, pilih menu, lalu bayar lewat **QRIS** — dilengkapi panel admin yang aman, tanpa dependensi npm, dan siap deploy di **Vercel**.

### 🌐 [Buka Frontend →] https://github.com/hayqalbanihakim212-crypto/qahwa/

*Tanpa scan QR meja, halaman hanya menampilkan menu. Tombol bayar baru aktif lewat tautan QR `/?m=KODE`.*

</div>

---

## Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| **Pesan via QR Meja** | Scan QR di meja, pelanggan langsung dikenali sebagai "Meja N" tanpa perlu memilih meja |
| **Bayar QRIS** | Terhubung ke Midtrans, atau simulasi penuh tanpa akun Midtrans (mode `mock`) |
| **Panel Admin** | Atur jumlah meja, cetak QR, dan pantau pesanan yang masuk ke dapur |
| **Meja Otomatis** | 1–60 meja plus QR "Bawa pulang", tiap QR memakai kode acak 8 karakter |
| **Layar Pembuka 3D** | Cangkir 3D (three.js) yang bisa diputar dengan geser, otomatis beralih ke versi CSS jika WebGL tidak tersedia |
| **Tampilan 3D** | Tema putih, tombol bertebal, kartu timbul, kartu menu miring mengikuti kursor, transisi balik halaman |
| **Keamanan Berlapis** | Hash scrypt, batas percobaan login, anti-CSRF, verifikasi webhook, CSP & HSTS |

---

## 🏗️ Arsitektur Sistem

```
{{DIAGRAM}}
```

---

## 💳 Mode Pembayaran

Diatur lewat environment variable `PAYMENT_MODE`:

| Mode | Midtrans | Keterangan |
|------|----------|------------|
| `mock` *(default)* | Tidak perlu | Simulasi penuh. Tombol **"Simulasikan bayar"** muncul di halaman status |
| `sandbox` | Kunci diawali `SB-` | Uji coba dengan simulator pembayaran Midtrans Sandbox |
| `production` | Kunci production | **Uang sungguhan.** Server menolak jika kunci masih kunci sandbox |

> Endpoint `/api/mockpay` hanya tersedia saat mode `mock`.

**Environment Variables:**

| Variabel | Dipakai di | Keterangan |
|----------|------------|------------|
| `PAYMENT_MODE` | Semua | `mock` (default), `sandbox`, atau `production` |
| `ADMIN_PASSWORD` | Lokal saja | Sandi polos untuk uji lokal, misalnya `admin123`. Diabaikan di Vercel dan mode `production` |
| `ADMIN_PASSWORD_HASH` | Vercel / production | Hash scrypt dari `node scripts/hash-password.js "kalimat sandi panjang"` |
| `MIDTRANS_SERVER_KEY` | Sandbox / production | Server key dari dashboard Midtrans |
| `MIDTRANS_CLIENT_KEY` | Sandbox / production | Client key dari dashboard Midtrans |

> Variabel koneksi Redis terisi otomatis saat integrasi Upstash Redis ditambahkan di Vercel.

---

## 🪑 Sistem Meja Otomatis

Setiap meja punya satu QR dengan alamat:

```
https://DOMAIN/?m=KODE        ← KODE = 8 karakter acak milik meja itu
```

- Pemilik mengatur jumlah meja di **Admin → Meja & QR** (1 sampai 60, ditambah opsi QR "Bawa pulang"), menekan **Cetak QR**, lalu menempel satu QR di tiap meja.
- Pelanggan yang scan langsung disambut "Selamat datang, pelanggan Meja N". Tidak ada pilihan meja, dan pesanan masuk dapur lengkap dengan nomor mejanya.
- Meja ditentukan oleh **server** dari KODE, bukan dari isian pelanggan, jadi tidak bisa dipalsukan dengan mengubah alamat. Daftar kode hanya bisa dilihat admin.
- Menambah jumlah meja tidak mengubah QR yang sudah dicetak. Mengurangi jumlah membuat QR meja yang dihapus tidak berlaku lagi (ada konfirmasi).
- Halaman tanpa QR atau dengan QR yang tidak dikenal tetap bisa melihat menu, tetapi tombol bayar nonaktif.
- Saat mencetak QR di komputer sendiri, ubah kolom **Alamat situs di dalam QR** menjadi alamat yang bisa dibuka HP, misalnya `http://192.168.1.5:3000`. Di Vercel kolom itu sudah benar sendiri.
- `/qr` hanya mengalihkan ke tab **Meja & QR** di admin, karena QR berisi kode yang tidak boleh terlihat publik.

---

## 🔒 Keamanan

| Area | Perlindungan |
|------|--------------|
| **Login admin** | Password di-hash (scrypt), maksimal 5 percobaan per 15 menit per IP, sesi acak 8 jam di server, cookie `HttpOnly` + `Secure` + `SameSite=Strict`, tombol Keluar mencabut sesi |
| **Password** | `ADMIN_PASSWORD` polos hanya berlaku di lokal. Di Vercel dan mode production wajib `ADMIN_PASSWORD_HASH` |
| **Aksi tulis** | Asal permintaan dicek (anti-CSRF), status pesanan hanya maju satu langkah, harga selalu dari server, ID pesanan acak kriptografis |
| **Webhook** | Notifikasi Midtrans diverifikasi tanda tangan dan nominalnya |
| **Header** | CSP, HSTS, dan anti-frame diatur di `vercel.json` |
| **Privasi** | Halaman pelanggan tidak punya tautan atau kode admin, dan `/admin` tidak diindeks mesin pencari |

> **Sebelum production:** ganti password, aktifkan 2FA di akun Vercel dan Midtrans, dan jangan commit file `.env`.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript (vanilla, tanpa framework dan tanpa build step) |
| Grafis 3D | three.js (lokal di `public/vendor/`) |
| QR Code | qrcode.js (lokal di `public/vendor/`) |
| Styling | Design system `ds.css` dengan token di `:root` |
| Backend | Node.js ≥ 18, Vercel Serverless Functions |
| Penyimpanan | Upstash Redis (Vercel), memori server (lokal) |
| Pembayaran | Midtrans QRIS (`mock` / `sandbox` / `production`) |
| Keamanan | scrypt, rate limiting, anti-CSRF, CSP, HSTS |
| Hosting | Vercel |
| Dependensi npm | Tidak ada |

---

## 🚀 Cara Menjalankan Lokal

Cukup Node.js 18+. Tanpa Redis, tanpa akun Midtrans, dan tanpa `npm install` karena tidak ada dependensi.

```bash
cd qahwa-vercel
```

Buat file `.env` di folder `qahwa-vercel/` (salin dari `.env.example` bila ada), lalu isi:

```env
PAYMENT_MODE=mock
ADMIN_PASSWORD=admin123
```

Jalankan server:

```bash
npm run dev      # atau: node scripts/dev.js
# → http://localhost:3000
```

1. Terminal menampilkan apakah `.env` terbaca dan apakah login admin siap. Setiap kali `.env` diubah, jalankan ulang server.
2. Buka http://localhost:3000/admin dan masuk, lalu buka tab **Meja & QR** dan atur jumlah meja.
3. Scan atau buka salah satu QR untuk melihat sisi pelanggan.

Untuk sandi sungguhan, buat hash lalu tempel hasilnya ke `ADMIN_PASSWORD_HASH`:

```bash
node scripts/hash-password.js "kalimat sandi panjang"
```

> Data lokal (termasuk daftar meja dan kode QR) hilang saat server dimatikan, jadi QR yang sudah dicetak hanya berlaku selama server yang sama berjalan. Di Vercel dengan Redis, datanya tetap.

---

## ☁️ Deploy ke Vercel

1. Import repo ini di [vercel.com/new](https://vercel.com/new), lalu atur **Root Directory** ke `qahwa-vercel`.
2. Tambahkan integrasi **Upstash Redis** lewat menu **Storage**.
3. Isi **Environment Variables**: `PAYMENT_MODE`, `ADMIN_PASSWORD_HASH`, dan untuk sandbox/production tambahkan `MIDTRANS_SERVER_KEY` serta `MIDTRANS_CLIENT_KEY`.
4. Di dashboard Midtrans, isi **Payment Notification URL** dengan `https://DOMAIN-KAMU/api/notify`.
5. Buka `https://DOMAIN-KAMU/admin`, masuk, lalu atur jumlah meja dan cetak QR di tab **Meja & QR**.

> Environment variable baru hanya berlaku pada deployment berikutnya, jadi lakukan **Redeploy** setelah mengubahnya. Setiap `git push` ke branch `main` juga memicu deploy otomatis.

---

## 🎨 Tampilan & Kustomisasi

- Semua gaya ada di `public/ds.css`. Ubah token di bagian `:root` untuk mengganti warna.
- Layar pembuka 3D (`public/intro.js` + three.js lokal di `public/vendor/`) tampil dulu sebelum menu. Cangkir bisa diputar dengan geser. Jika WebGL tidak ada atau gagal dimuat, otomatis tampil versi CSS.

---

## 📁 Struktur Proyek

```
qahwa/
├── README.md
├── qahwa-preview.html           # Pratinjau statis
└── qahwa-vercel/
    ├── api/                     # Vercel Serverless Functions
    │   ├── _lib.js              # Helper bersama
    │   ├── admin.js
    │   ├── auth.js
    │   ├── menu.js
    │   ├── mockpay.js           # Hanya aktif di mode mock
    │   ├── notify.js            # Webhook Midtrans
    │   ├── order.js
    │   └── table.js
    ├── public/                  # Frontend statis
    │   ├── index.html           # Halaman pelanggan
    │   ├── app.js
    │   ├── intro.js             # Layar pembuka 3D
    │   ├── admin.html           # Panel admin
    │   ├── admin.js
    │   ├── qr.html              # Dialihkan ke admin, tab Meja & QR
    │   ├── ds.css               # Design system (token di :root)
    │   └── vendor/              # three.js & qrcode.js (lokal)
    ├── scripts/
    │   ├── dev.js               # Server lokal (npm run dev)
    │   ├── hash-password.js     # Buat hash sandi (npm run hash)
    │   └── build-preview.js     # Bangun qahwa-preview.html (npm run preview)
    ├── .gitignore
    ├── package.json
    ├── qahwa-preview.html
    └── vercel.json              # Header keamanan (CSP, HSTS, anti-frame)
```

---

<div align="center">

⚠️ *Mode `mock` dan `sandbox` tidak memproses uang sungguhan. Jangan pernah commit file `.env` atau kunci Midtrans ke repository.*

---

Made by [hayqalbanihakim212-crypto](https://github.com/hayqalbanihakim212-crypto)

</div>
