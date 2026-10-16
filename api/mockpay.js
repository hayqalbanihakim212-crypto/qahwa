// Hanya aktif saat PAYMENT_MODE=mock. Di sandbox/production endpoint ini tidak ada.
const {
  MODE,
  getOrder,
  putOrder,
  sameOrigin,
  ID_RE,
  ip,
  limit,
  secOk,
} = require("./_lib");
module.exports = async (req, res) => {
  try {
    if (MODE !== "mock") return res.status(404).end();
    if (req.method !== "POST") return res.status(405).end();
    if (!sameOrigin(req)) return res.status(403).json({ error: "origin" });
    if (!(await limit("rl:mock:" + ip(req), 60, 600)))
      return res.status(429).json({ error: "too_many" });
    const { id, result } = req.body || {};
    const o = ID_RE.test(String(id)) ? await getOrder(id) : null;
    if (
      !o ||
      !secOk(o, req.headers["x-order-token"]) ||
      o.status !== "pending" ||
      !["paid", "failed"].includes(result)
    )
      return res.status(400).json({ error: "bad" });
    o.status = result;
    await putOrder(o);
    res.json({ ok: 1 });
  } catch (e) {
    res.status(500).json({ error: "server" });
  }
};
