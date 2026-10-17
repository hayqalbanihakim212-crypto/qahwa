const {
  MODE,
  redis,
  getOrder,
  putOrder,
  isAdmin,
  sameOrigin,
  ID_RE,
  listOrders,
} = require("./_lib");
const NEXT = { paid: "making", making: "ready", ready: "done" }; // alur hanya maju satu langkah
module.exports = async (req, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth" });
    if (req.method === "POST") {
      if (!sameOrigin(req)) return res.status(403).json({ error: "origin" });
      const { id, status } = req.body || {};
      const o = ID_RE.test(String(id)) ? await getOrder(id) : null;
      if (!o) return res.status(404).json({ error: "not_found" });
      if (NEXT[o.status] !== status)
        return res.status(409).json({ error: "bad_step" });
      o.status = status;
      await putOrder(o);
      return res.json({ ok: 1 });
    }
    if (req.method !== "GET") return res.status(405).end();
    // arsip permanen untuk Statistik dan Riwayat: /api/admin?hist=1&since=<ms>
    if (req.query && req.query.hist !== undefined)
      return res.json({
        mode: MODE,
        orders: await listOrders(req.query.since),
      });
    const ids = await redis("LRANGE", "orders", 0, 99);
    const vals = ids.length
      ? await redis("MGET", ...ids.map((i) => "order:" + i))
      : [];
    res.json({
      mode: MODE,
      orders: vals.filter(Boolean).map((v) => {
        const o = JSON.parse(v);
        delete o.sh;
        return o;
      }),
    });
  } catch (e) {
    res.status(500).json({ error: "server" });
  }
};
