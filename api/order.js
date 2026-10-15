const {
  MODE,
  MT,
  basic,
  MENU,
  configError,
  redis,
  getOrder,
  putOrder,
  sync,
  newId,
  ID_RE,
  ip,
  sameOrigin,
  limit,
  tableByCode,
} = require("./_lib");
module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const id = String(req.query.id || "");
      let o = ID_RE.test(id) ? await getOrder(id) : null;
      if (!o) return res.status(404).json({ error: "not_found" });
      o = await sync(o);
      return res.json({
        id: o.id,
        status: o.status,
        total: o.total,
        table: o.table,
        name: o.name,
        items: o.items,
      });
    }
    if (req.method !== "POST") return res.status(405).end();
    if (!sameOrigin(req)) return res.status(403).json({ error: "origin" });
    const err = configError();
    if (err) return res.status(503).json({ error: "config" });
    if (!(await limit("rl:order:" + ip(req), 30, 600)))
      return res.status(429).json({ error: "too_many" });
    const b = req.body || {},
      items = [];
    let total = 0;
    for (const x of Array.isArray(b.items) ? b.items.slice(0, 30) : []) {
      const m = MENU.find((m) => m.id === x.id),
        q = Math.floor(Number(x.q));
      if (!m || !m.p || !(q >= 1 && q <= 20)) continue;
      items.push({ id: m.id, n: m.n, q, p: m.p });
      total += q * m.p; // harga selalu dari server
    }
    const tb = await tableByCode(b.code); // meja ditentukan server dari kode QR, bukan dari isian pelanggan
    if (!tb) return res.status(400).json({ error: "table" });
    const table = tb.t;
    if (!items.length || total > 5000000)
      return res.status(400).json({ error: "bad" });
    const id = newId();
    const o = {
      id,
      name:
        String(b.name || "")
          .trim()
          .slice(0, 30) || "Tamu",
      table,
      note: String(b.note || "").slice(0, 60),
      items,
      total,
      status: "pending",
      ts: Date.now(),
    };
    let token = "mock";
    if (MODE !== "mock") {
      const r = await fetch(MT.snap, {
        method: "POST",
        headers: {
          Authorization: basic,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          transaction_details: { order_id: id, gross_amount: total },
          item_details: items.map((i) => ({
            id: String(i.id),
            name: i.n.slice(0, 50),
            price: i.p,
            quantity: i.q,
          })),
          customer_details: { first_name: o.name },
          expiry: { unit: "minutes", duration: 15 },
        }),
      });
      const j = await r.json();
      if (!j.token) {
        console.error("midtrans", j.error_messages || j.status_message);
        return res.status(502).json({ error: "midtrans" });
      }
      token = j.token;
    }
    await putOrder(o);
    await redis("LPUSH", "orders", id);
    await redis("LTRIM", "orders", 0, 499);
    res.json({ id, token });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "server" });
  }
};
