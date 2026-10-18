// GET ?c=KODE   (publik)  -> { t: "5" }  nama meja untuk kode di QR; 404 jika kode tidak dikenal
// GET            (admin)  -> { tables: [{ t, k }] }  daftar meja beserta kode QR-nya
// POST {count, takeaway} (admin) -> atur jumlah meja (1-60), opsional QR "Bawa pulang"
const {
  handle,
  allow,
  HttpError,
  requireAdmin,
  requireSameOrigin,
  rateLimit,
  ip,
  getTables,
  setTables,
  tableByCode,
} = require("./_lib");

module.exports = handle(async (req, res) => {
  if (req.method === "GET" && req.query.c !== undefined) {
    await rateLimit("rl:table:" + ip(req), 120, 600);
    const table = await tableByCode(req.query.c);
    if (!table) throw new HttpError(404, "not_found");
    return res.json({ t: table.t }); // hanya nama meja; kode lain tidak pernah dikirim ke publik
  }

  await requireAdmin(req);
  if (req.method === "GET") return res.json({ tables: await getTables() });
  allow(req, "POST");
  requireSameOrigin(req);

  const b = req.body || {},
    count = Math.floor(Number(b.count));
  if (!(count >= 1 && count <= 60)) throw new HttpError(400, "bad");
  res.json({ tables: await setTables(count, b.takeaway === true) });
});
