/* Meja: pemilik mengatur jumlah meja; tiap meja punya kode acak yang ditanam di QR-nya.
   Pelanggan tidak memilih meja. Server yang menentukan meja dari kode QR, jadi meja tidak bisa dipalsukan. */
const { kv } = require("./store");
const { randomCode } = require("./security");

const TAKEAWAY = "Bawa pulang";
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

// [{ t: "5", k: "KODE8HURUF" }, ...] ; kosong = pemilik belum mengatur meja
const getTables = async () => {
  try {
    const a = JSON.parse((await kv("GET", "cfg:tables")) || "[]");
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
};

async function setTables(n, takeaway) {
  // kode meja yang sudah ada dipertahankan, jadi QR cetakan lama tetap berlaku saat jumlah ditambah
  const keep = new Map((await getTables()).map((x) => [x.t, x.k]));
  const names = Array.from({ length: n }, (_, i) => String(i + 1));
  if (takeaway) names.push(TAKEAWAY);
  const list = names.map((t) => ({ t, k: keep.get(t) || randomCode(8) }));
  await kv("SET", "cfg:tables", JSON.stringify(list));
  return list;
}

const tableByCode = async (code) => {
  code = String(code || "").toUpperCase();
  if (!CODE_RE.test(code)) return null;
  return (await getTables()).find((x) => x.k === code) || null;
};

module.exports = { TAKEAWAY, getTables, setTables, tableByCode };
