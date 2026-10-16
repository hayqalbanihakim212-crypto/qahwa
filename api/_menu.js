// Menu Qahwa (sesuai foto menu terbaru).
// Format item:
//   "Nama"                          -> belum ada harga, tampil "Segera" dan belum bisa dipesan
//   "Nama=15000"                    -> satu harga
//   "Nama=Panas:17000|Dingin:20000" -> ada pilihan varian (Panas / Dingin / Float), tiap varian punya harga sendiri
// ID dibuat dari URUTAN. Jangan menyisipkan atau menghapus item di tengah daftar; tambah item baru di akhir daftar
// supaya ID lama (stok, riwayat pesanan) tidak bergeser. Mengubah nama atau harga aman.
const k = (n) => n * 1000;
const HD = (n, h, d) => `${n}=Panas:${k(h)}|Dingin:${k(d)}`; // panas + dingin
const HDF = (n, h, d, f) => `${n}=Panas:${k(h)}|Dingin:${k(d)}|Float:${k(f)}`; // panas + dingin + float
const P = (n, h) => `${n}=${k(h)}`; // satu harga

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
  "Besides Coffee": [
    HD("Teh", 6, 8),
    HD("Teh Tarik", 15, 17),
    HD("Teh Susu", 15, 17),
    HD("Susu", 10, 13),
    HD("Teh Susu Telur", 16, 18),
    HD("Lemontea", 15, 18),
    HD("Lemontea Jahe", 17, 20),
    HD("Greentea", 12, 15),
    HD("Greentea Lemon", 14, 17),
    HD("Greentea Susu", 18, 15), // PERIKSA: di foto panas 18.000, dingin 15.000
    P("Puding", 15),
    HD("Milo", 13, 15),
    P("Milo Cincau", 16),
    P("Cincau", 13),
    P("Cappucino Cincau", 16),
    HD("Cappucino", 13, 16),
    HD("Cokelat", 13, 16),
  ],
  "Latte or Float": [
    HDF("Cappucino", 20, 22, 25),
    HDF("Mocha", 20, 22, 25),
    HDF("Red Velvet", 20, 22, 25),
    HDF("Taro", 20, 22, 25),
    HDF("Vanilla", 20, 22, 25),
    HDF("Hazelnut", 20, 22, 25),
    HDF("Tiramisu", 20, 22, 25),
    HDF("Manggo", 20, 22, 25),
    HDF("Macha", 20, 22, 25),
  ],
  "Other Menu": [
    HD("Teh Ginger", 13, 15),
    HD("Susu Ginger", 15, 16),
    P("Affogato", 22),
    P("Avocado Espresso", 22),
    P("Avocado Float Espresso", 30),
    HD("Infused Water", 12, 14),
    P("Ice Calamansi", 14),
    P("Ice Cream Vanilla", 12),
  ],
  Mocktail: [
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
  Makanan: [
    P("Mie Bangladesh", 14),
    P("Mie Bangladesh Double", 18),
    P("Indomie", 14),
    P("Indomie Udang/Cumi", 22),
    P("Indomie Seafood", 27),
    P("Ifumie", 15),
    P("Ifumie Udang/Cumi", 22),
    P("Ifumie Seafood", 27),
    P("Mie Hun", 15),
    P("Mie Hun Udang/Cumi", 22),
    P("Mie Hun Seafood", 27),
    P("Mie Aceh", 15),
    P("Mie Aceh Udang/Cumi", 22),
    P("Mie Aceh Seafood", 27),
    P("Ayam Penyet/Pecak", 18),
    P("Nasi Goreng", 15),
    P("Nasi Goreng Udang/Cumi", 27),
    P("Nasi Goreng Ayam", 25),
    P("Nasi Goreng Seafood", 30),
    P("Nasi Goreng Kampung", 17),
    P("Nasi Goreng Kampung Udang/Cumi", 27),
    P("Nasi Goreng Kampung Ayam", 25),
    P("Nasi Goreng Kampung Seafood", 30),
  ],
  // Crispy dan Tambahan: foto menunya belum dikirim, harga diisi nanti ("Segera" sampai ada harga)
  Crispy: [
    "Kentang Original",
    "Kentang BBQ",
    "Jagung Bakar",
    "Kentang Sapi Panggang/Balodo",
    "Kentang Rumput Laut/Saus Keju",
    "Banana Roll",
    "Banana Nugget",
    "Nugget",
    "Nugget Mix",
    "Tahu Walik",
    "Tempe Crispy",
    "Risol Ayam",
    "Sosis",
  ],
  Tambahan: ["Nasi Putih", "Sambal Penyet/Pecak"],
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
