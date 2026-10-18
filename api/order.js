// GET  ?id=...  -> status pesanan (butuh header x-order-token)
// POST          -> buat pesanan + token pembayaran
const {
  MODE,
  handle,
  allow,
  HttpError,
  requireSameOrigin,
  rateLimit,
  configError,
  getMenu,
  getOrder,
  createOrder,
  tableByCode,
  createPaymentToken,
  sync,
  newId,
  newSecret,
  secOk,
  sha,
  clean,
  ip,
  ID_RE,
} = require("./_lib");

const MAX_LINES = 30; // baris keranjang per pesanan
const MAX_QTY = 20; // jumlah per baris

async function readOrder(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  await rateLimit("rl:ordget:" + ip(req), 600, 60);
  const id = String(req.query.id || "");
  let order = ID_RE.test(id) ? await getOrder(id) : null;
  // 404 yang sama untuk "tidak ada" dan "token salah", supaya ID tidak bisa ditebak
  if (!order || !secOk(order, req.headers["x-order-token"]))
    throw new HttpError(404, "not_found");
  order = await sync(order);
  res.json({
    id: order.id,
    status: order.status,
    total: order.total,
    table: order.table,
    name: order.name,
    items: order.items,
  });
}

/* Susun baris pesanan dari keranjang. Nama dan harga SELALU dari menu di server, bukan dari klien.
   Menu habis, kategori ditutup, atau varian tidak ada -> 409. Baris dengan jumlah tidak valid dilewati. */
function priceItems(rawItems, menu, closed) {
  const items = [];
  let total = 0;
  for (const x of Array.isArray(rawItems) ? rawItems.slice(0, MAX_LINES) : []) {
    const m = menu.find((m) => m.id === x.id),
      qty = Math.floor(Number(x.q));
    if (!m || m.off || closed.includes(m.c))
      throw new HttpError(409, "unavailable");
    let price = m.p,
      name = m.n,
      variant;
    if (m.v) {
      // menu bervarian: varian wajib dipilih dan harus ada di daftar server
      const vr = m.v.find((z) => z.k === x.v);
      if (!vr || vr.off) throw new HttpError(409, "unavailable");
      price = vr.p;
      name = `${m.n} (${vr.k})`;
      variant = vr.k;
    }
    if (!price || !(qty >= 1 && qty <= MAX_QTY)) continue;
    items.push({ id: m.id, v: variant, n: name, q: qty, p: price });
    total += qty * price;
  }
  return { items, total };
}

async function placeOrder(req, res) {
  requireSameOrigin(req);
  if (configError()) throw new HttpError(503, "config");
  await rateLimit("rl:order:" + ip(req), 30, 600);

  const b = req.body || {};
  const { menu, closed } = await getMenu();
  const { items, total } = priceItems(b.items, menu, closed);
  if (!items.length) throw new HttpError(400, "empty"); // keranjang kosong / semua baris tidak valid

  // meja ditentukan server dari kode QR, bukan dari isian pelanggan
  const table = await tableByCode(b.code);
  if (!table) throw new HttpError(400, "table");
  await rateLimit("rl:ordtb:" + table.t, 40, 600);

  const id = newId(),
    sec = newSecret();
  const order = {
    id,
    name: clean(b.name, 30) || "Tamu",
    table: table.t,
    note: clean(b.note, 60),
    sh: sha(sec, "sha256"), // hanya hash rahasia yang disimpan
    items,
    total,
    status: "pending",
    ts: Date.now(),
  };
  const token = await createPaymentToken(order); // gagal di Midtrans -> 502, pesanan belum tersimpan
  await createOrder(order);
  res.json({ id, token, sec });
}

module.exports = handle(async (req, res) => {
  if (req.method === "GET") return readOrder(req, res);
  allow(req, "POST");
  return placeOrder(req, res);
});
