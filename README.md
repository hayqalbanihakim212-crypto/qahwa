<div align="center">

# ☕ Qahwa — Pesan & Bayar QRIS
### *Sistem Pemesanan Kafe Berbasis QR Meja dengan Pembayaran QRIS*

[![Node.js](https://img.shields.io/badge/Node.js-≥18-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/docs/Web/CSS)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Midtrans](https://img.shields.io/badge/Midtrans-QRIS-003D79?style=for-the-badge)](https://midtrans.com/)

> Aplikasi web untuk memesan menu dan membayar lewat **QRIS**. Pelanggan scan QR di meja, pesan, bayar, dan pesanan langsung masuk ke dapur lengkap dengan nomor mejanya. Tanpa dependensi npm, cukup Node.js.

### 🌐 [Buka Frontend →](https://hayqalbanihakim212-crypto.github.io/qahwa/qahwa-vercel/public/index.html)
### 🔐 [Buka Panel Admin (Dashboard) →](https://hayqalbanihakim212-crypto.github.io/qahwa/qahwa-vercel/public/admin.html)

*Untuk melihat tampilan langsung, jalankan server lokal (`npm run dev`) lalu buka `http://localhost:3000` dan `http://localhost:3000/admin`.*

</div>

---

## Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| **Menu & Pesanan** | Pelanggan melihat menu dan memesan langsung dari HP |
| **Bayar QRIS** | Pembayaran lewat Midtrans, atau simulasi penuh untuk uji coba |
| **Meja Otomatis** | Satu QR unik per meja, nomor meja ditentukan server |
| **Panel Admin** | Kelola meja, cetak QR, dan pantau status pesanan |
| **Layar Pembuka 3D** | Cangkir kopi 3D yang bisa diputar, dengan cadangan versi CSS |
| **Aman** | Login ter-hash, anti CSRF, webhook diverifikasi tanda tangan |

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────┐
│              FRONTEND (HTML + CSS + JS)             │
│                                                     │
│  public/                                            │
│  ├── ds.css      → Design system (token di :root)   │
│  ├── intro.js    → Layar pembuka 3D                 │
│  └── vendor/     → three.js lokal                   │
│                                                     │
│  Halaman: Menu · Status Pesanan · Admin             │
└──────────────────────┬──────────────────────────────┘
                       │ /api/*
┌──────────────────────▼──────────────────────────────┐
│                 BACKEND (Node.js ≥ 18)              │
│                                                     │
│  ├── scripts/dev.js            → Server lokal       │
│  ├── scripts/hash-password.js  → Hash sandi admin   │
│  ├── scripts/build-preview.js  → Build pratinjau    │
│  ├── /api/mockpay  → Simulasi bayar (mode mock)     │
│  └── /api/notify   → Webhook Midtrans               │
│                                                     │
│  Data: in-memory (lokal) · Redis (opsional, tetap)  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (mode sandbox / production)
┌──────────────────────▼──────────────────────────────┐
│                 Midtrans (External)                 │
│              Pembayaran QRIS + Notifikasi           │
└─────────────────────────────────────────────────────┘
```

---

## 💳 Mode Pembayaran (`PAYMENT_MODE`)

| Mode | Keterangan |
|------|------------|
| `mock` | Simulasi penuh tanpa Midtrans. Tombol "Simulasikan bayar" muncul di halaman status. **Default.** |
| `sandbox` | Midtrans uji (kunci diawali `SB-`). Pakai simulator pembayaran Midtrans Sandbox. |
| `production` | Uang sungguhan. Server menolak jika kunci masih kunci sandbox. |

> Endpoint `/api/mockpay` hanya ada saat mode `mock`.

---

## 🪑 Sistem Meja Otomatis

- Pemilik mengatur jumlah meja di **Admin > Meja & QR** (1 sampai 60, ditambah opsi QR "Bawa pulang"), lalu menekan **Cetak QR** dan menempel satu QR di tiap meja.
- Setiap QR berisi alamat `https://DOMAIN/?m=KODE`, dengan `KODE` acak 8 karakter milik meja itu. Pelanggan yang scan langsung disambut "Selamat datang, pelanggan Meja N", tanpa pilihan meja, dan pesanan masuk dapur dengan nomor mejanya.
- Meja ditentukan server dari `KODE`, bukan dari isian pelanggan, sehingga tidak bisa dipalsukan dengan mengubah alamat. Daftar kode hanya bisa dilihat admin.
- Menambah jumlah meja tidak mengubah QR yang sudah dicetak. Mengurangi jumlah membuat QR meja yang dihapus tidak berlaku lagi (ada konfirmasi).
- Halaman tanpa QR atau dengan QR yang tidak dikenal tetap bisa melihat menu, tetapi tombol bayar nonaktif.
- Saat mencetak QR di komputer sendiri, ubah kolom "Alamat situs di dalam QR" menjadi alamat yang bisa dibuka HP, misalnya `http://192.168.1.5:3000`.
- `/qr` hanya mengalihkan ke tab Meja & QR di admin, karena QR berisi kode yang tidak boleh terlihat publik.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Runtime | Node.js ≥ 18 (tanpa dependensi npm) |
| Frontend | HTML, CSS, JavaScript murni |
| Visual 3D | three.js (lokal di `public/vendor/`) |
| Styling | Design system sendiri (`public/ds.css`) |
| Pembayaran | Midtrans (QRIS) |
| Hash Sandi | scrypt (bawaan Node.js) |
| Penyimpanan | In-memory (lokal), Redis (opsional) |

---

## 🚀 Cara Menjalankan Lokal

Tanpa Redis dan tanpa akun Midtrans.

### 1. Siapkan `.env`

```bash
cd qahwa-vercel
cp .env.example .env
```

Untuk uji lokal, `ADMIN_PASSWORD=admin123` sudah cukup. Untuk sandi sungguhan:

```bash
npm run hash -- "kalimat sandi panjang"
# tempel hasilnya ke ADMIN_PASSWORD_HASH di .env
```

### 2. Jalankan server

```bash
npm run dev
# → http://localhost:3000
```

Terminal menampilkan apakah `.env` terbaca dan apakah login admin siap. Setiap kali `.env` diubah, jalankan ulang server.

### 3. Atur meja

Buka http://localhost:3000/admin, masuk, buka tab **Meja & QR**, atur jumlah meja. Setelah itu scan atau buka salah satu QR untuk melihat sisi pelanggan.

> ⚠️ Data lokal (termasuk daftar meja dan kode QR) hilang saat server dimatikan, jadi QR yang sudah dicetak hanya berlaku selama server yang sama berjalan. Gunakan Redis agar data tetap tersimpan.

### Script yang tersedia

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Menjalankan server lokal |
| `npm run hash` | Membuat hash sandi admin |
| `npm run preview` | Membangun pratinjau |

---

## 🔒 Keamanan yang Sudah Ada

- `ADMIN_PASSWORD` (polos) hanya berlaku di komputer lokal. Di mode `production` diabaikan; wajib `ADMIN_PASSWORD_HASH`.
- Login admin: sandi di-hash (scrypt), maksimal 5 percobaan per 15 menit per IP, sesi acak 8 jam di server, cookie `HttpOnly` + `Secure` + `SameSite=Strict`, tombol Keluar mencabut sesi.
- Semua aksi tulis dicek asalnya (anti CSRF), status pesanan hanya maju satu langkah, harga selalu dari server, ID pesanan acak kriptografis.
- Webhook Midtrans diverifikasi tanda tangan dan nominalnya. Header CSP, HSTS, dan anti-frame diterapkan.
- Halaman pelanggan tidak punya tautan atau kode admin; `/admin` tidak diindeks mesin pencari.

**Sebelum production:** ganti password, aktifkan 2FA pada akun Midtrans, dan jangan commit file `.env`.

---

## 🎨 Tampilan

- Tema putih bergaya 3D: tombol bertebal, kartu timbul, kartu menu miring mengikuti kursor, transisi balik halaman.
- Layar pembuka 3D (`public/intro.js` + three.js lokal) tampil sebelum menu. Cangkir bisa diputar dengan geser. Jika WebGL tidak ada atau gagal dimuat, otomatis tampil versi CSS.
- Semua gaya ada di `public/ds.css`; ubah token di bagian `:root` untuk mengganti warna.

---

## 📁 Struktur Proyek

```
qahwa/
├── qahwa-vercel/            # Kode aplikasi utama
│   ├── public/
│   │   ├── admin.html       # Dashboard admin
│   │   ├── ds.css           # Design system
│   │   ├── intro.js         # Layar pembuka 3D
│   │   └── vendor/          # three.js lokal
│   ├── scripts/
│   │   ├── dev.js           # Server lokal
│   │   ├── hash-password.js # Hash sandi admin
│   │   └── build-preview.js # Build pratinjau
│   ├── .env.example
│   └── package.json
├── qahwa-preview.html       # Pratinjau satu file
└── README.md
```

---

<div align="center">

!! *Gunakan mode `sandbox` untuk uji coba. Pastikan semua kunci dan sandi aman sebelum menerima uang sungguhan.*

</div>
