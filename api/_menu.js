// Menu Qahwa (sesuai foto menu terbaru: Best Seller sampai Roti Canai).
// Format item:
//   "Nama"                          -> belum ada harga, tampil "Segera" dan belum bisa dipesan
//   "Nama=15000"                    -> satu harga
//   "Nama=Panas:17000|Dingin:20000" -> ada pilihan varian (Panas / Dingin / Float), tiap varian punya harga sendiri
// ID dibuat dari URUTAN. Jangan menyisipkan atau menghapus item di tengah daftar setelah toko berjalan;
// tambah item baru di akhir daftar supaya ID lama (stok, riwayat pesanan) tidak bergeser.
// Mengubah nama atau harga aman.
const k = (n) => n * 1000;
const HD = (n, h, d) => `${n}=Panas:${k(h)}|Dingin:${k(d)}`; // panas + dingin
const HDF = (n, h, d, f) => `${n}=Panas:${k(h)}|Dingin:${k(d)}|Float:${k(f)}`; // panas + dingin + float
const P = (n, h) => `${n}=${k(h)}`; // satu harga
// satu hidangan dengan beberapa jenis; nama hidangan ikut di depan supaya antrian dapur jelas
// contoh: G("Martabak", [["Biasa", 15]]) -> "Martabak Biasa" = 15.000
const G = (dish, rows) => rows.map(([j, h]) => P(`${dish} ${j}`, h));

const DATA = {
  "Best Seller": [
    P("Sanger Aren", 22),
    P("Sanger Creamy", 20),
    P("Sanger Panas", 17),
    P("Sanger Dingin", 20),
  ],
  Espresso: [
    HD("Americano", 17, 20),
    P("Single Espresso", 15), // hanya panas
    P("Double Espresso", 17), // hanya panas
    HD("Mocha Espresso", 20, 22),
    HD("Longblack", 17, 20),
    HD("Coffee Lemon", 17, 20),
    HD("Coffee Latte", 20, 22),
    P("Ice Coffee", 20), // hanya dingin
  ],
  Juice: [
    P("Pokat", 15),
    P("Terong Belanda", 15),
    P("Markisa", 15),
    P("Martabe", 17),
    P("Sister", 17),
    P("Jeruk", 15),
    P("Sirsak", 15),
    P("Kuini", 15),
    P("Avocado Cheese", 17),
  ],
  "Soft Based Drinks": [
    HD("Teh", 6, 8),
    HD("Teh Tarik", 15, 17),
    HD("Teh Susu", 15, 17),
    HD("Teh Susu Telur", 16, 18),
    HD("Lemontea", 15, 18),
    HD("Lemontea Jahe", 17, 20),
    HD("Greentea", 12, 15),
    HD("Greentea Lemon", 14, 17),
    HD("Greentea Susu", 18, 15),
    HD("Susu", 10, 13),
    HD("Milo", 13, 15),
    P("Milo Cincau", 16), // hanya panas
    P("Cappucino Cincau", 16), // hanya panas
    HD("Cappucino", 13, 16),
    HD("Coklat", 13, 16),
    P("Cincau", 13), // hanya panas
    P("Puding", 15), // hanya panas
  ],
  "Latte or Float": [
    HDF("Cappucino", 20, 22, 25),
    HDF("Mocha", 20, 22, 25),
    HDF("Red Velvet", 20, 22, 25),
    HDF("Taro", 20, 22, 25),
    HDF("Vanilla", 20, 22, 25),
    HDF("Hazelnut", 20, 22, 25),
    HDF("Tiramisu", 20, 22, 25),
    HDF("Mango", 20, 22, 25),
    HDF("Matcha", 20, 22, 25),
  ],
  "Other Menu": [
    HD("Teh Ginger", 13, 15),
    HD("Susu Ginger", 15, 16),
    P("Affogato", 22), // hanya dingin
    P("Avocado Float Espresso", 30), // hanya dingin
    P("Avocado Espresso", 22), // hanya dingin
    HD("Infused Water", 12, 14),
    P("Ice Calamansi", 14), // hanya dingin
    P("Ice Cream Vanilla", 12), // hanya dingin
  ],
  "Based Soda": [
    // semua mocktail disajikan dingin
    P("Ocean Blue", 20),
    P("Blue Mojito", 20),
    P("Red Mojito", 20),
    P("Red Blue", 20),
    P("Red Squash", 20),
    P("Mojito Squash", 20),
    P("Melon Squash", 20),
    P("Lychee Squash", 20),
    P("Lime Squash", 20),
    P("Manggo Squash", 20),
    P("Ice Smoothies Manggo", 20),
  ],
  "Nasi Goreng": G("Nasi Goreng", [
    ["Telur", 15],
    ["Cumi", 25],
    ["Udang", 25],
    ["Daging", 25],
    ["Ayam", 25],
    ["SeaFood", 30],
    ["Special", 35],
  ]),
  "Nasi Goreng Kampung": G("Nasi Goreng Kampung", [
    ["Telur", 17],
    ["Cumi", 27],
    ["Udang", 27],
    ["Daging", 25],
    ["Ayam", 25],
    ["SeaFood", 30],
    ["Special", 35],
  ]),
  "Nasi Goreng Ijo": G("Nasi Goreng Ijo", [
    ["Telur", 17],
    ["Cumi", 27],
    ["Udang", 27],
    ["Daging", 25],
    ["SeaFood", 30],
    ["Special", 35],
  ]),
  "Nasi Goreng Pataya": G("Nasi Goreng Pataya", [
    ["Biasa", 23],
    ["Cumi", 28],
    ["Daging", 28],
    ["Seafood", 35],
    ["Special", 40],
  ]),
  Snack: [
    P("Nugget", 18),
    P("Sosis", 18),
    P("Mix Platter (Nugget, Sosis, Kentang)", 20),
    P("Jamur Crispy", 20),
    P("Kentang", 18),
    P("Nasi", 5),
  ],
  "Chicken Katsu": G("Chicken Katsu", [
    ["Biasa", 20],
    ["Kari Ayam", 28],
    ["Special", 35],
  ]),
  "Martabak": G("Martabak", [
    ["Biasa", 15],
    ["Kari Ayam", 20],
    ["Udang", 23],
    ["Daging", 23],
    ["Special", 28],
  ]),
  "Kue/Mie Tiaw": G("Kue/Mie Tiaw", [
    ["Biasa", 15],
    ["Cumi", 22],
    ["Udang", 22],
    ["Daging", 28],
    ["SeaFood", 27],
    ["Special", 35],
  ]),
  "Toom Yum": G("Toom Yum", [
    ["Biasa", 20],
    ["Daging", 25],
    ["Cumi", 25],
    ["Udang", 25],
    ["SeaFood", 30],
    ["Special", 40],
  ]),
  "Roti Canai": G("Roti Canai", [
    ["Gula", 10],
    ["Kari Ayam", 15],
    ["Cokelat", 15],
    ["Keju", 15],
    ["Cokelat Keju", 15],
  ]),
  "Roti Bakar": G("Roti Bakar", [
    ["Biasa", 10],
    ["Keju", 15],
    ["Cokelat", 15],
  ]),
  "Burgers": G("Burgers", [
    ["Biasa", 20],
    ["Ayam", 25],
    ["Daging", 25],
    ["SeaFood", 30],
    ["Special", 35],
  ]),
};

let id = 0;
const num = (x) => Math.max(0, Math.floor(Number(x)) || 0);
module.exports = Object.entries(DATA).flatMap(([c, list]) =>
  list.map((s) => {
    const i = s.indexOf("="),
      n = i < 0 ? s : s.slice(0, i),
      spec = i < 0 ? "" : s.slice(i + 1);
    const item = { id: ++id, c, n, p: 0 };
    if (spec.includes(":")) {
      // varian: p = harga termurah ("mulai dari"), v = daftar varian
      const v = spec
        .split("|")
        .map((z) => {
          const [vk, vp] = z.split(":");
          return { k: vk.trim(), p: num(vp) };
        })
        .filter((z) => z.k && z.p > 0);
      if (v.length) {
        item.p = Math.min(...v.map((z) => z.p));
        if (v.length > 1) item.v = v;
        else item.p = v[0].p;
      }
    } else item.p = num(spec);
    return item;
  }),
);
