// Khusus admin.
// GET                       -> 100 pesanan terbaru (antrian langsung)
// GET ?hist=1&since=<ms>    -> arsip permanen untuk Statistik dan Riwayat
// POST { id, status }       -> majukan status pesanan satu langkah
const {
  MODE,
  handle,
  allow,
  HttpError,
  requireAdmin,
  requireSameOrigin,
  getOrder,
  putOrder,
  recentOrders,
  listOrders,
  ID_RE,
} = require("./_lib");

const NEXT = { paid: "making", making: "ready", ready: "done" }; // alur hanya maju satu langkah
const LIVE_COUNT = 100;

async function advance(req, res) {
  requireSameOrigin(req);
  const { id, status } = req.body || {};
  const order = ID_RE.test(String(id)) ? await getOrder(id) : null;
  if (!order) throw new HttpError(404, "not_found");
  if (NEXT[order.status] !== status) throw new HttpError(409, "bad_step");
  order.status = status;
  await putOrder(order);
  res.json({ ok: 1 });
}

module.exports = handle(async (req, res) => {
  await requireAdmin(req);
  if (req.method === "POST") return advance(req, res);
  allow(req, "GET");
  const orders =
    req.query && req.query.hist !== undefined
      ? await listOrders(req.query.since)
      : await recentOrders(LIVE_COUNT);
  res.json({ mode: MODE, orders });
});
