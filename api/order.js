const {
  MODE,
  MT,
  basic,
  getMenu,
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
  sha,
  newSecret,
  secOk,
  clean,
} = require("./_lib");
module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "private, no-store");
      if (!(await limit("rl:ordget:" + ip(req), 600, 60)))
        return res.status(429).json({ error: "too_many" });
      const id = String(req.query.id || "");
      let o = ID_RE.test(id) ? await getOrder(id) : null;
      // 404 yang sama untuk "tidak ada" dan "token salah", supaya ID tidak bisa ditebak
      if (!o || !secOk(o, req.headers["x-order-token"]))
        return res.status(404).json({ error: "not_found" });
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
    const { menu: MENU, closed } = await getMenu();
    for (const x of Array.isArray(b.items) ? b.items.slice(0, 30) : []) {
      const m = MENU.find((m) => m.id === x.id),
        q = Math.floor(Number(x.q));
      if (!m || m.off || closed.includes(m.c))
        return res.status(409).json({ error: "unavailable" });
      let p = m.p,
        n = m.n,
        vk;
      if (m.v) {
        // menu bervarian: varian wajib dipilih dan harus ada di daftar server
        const vr = m.v.find((z) => z.k === x.v);
        if (!vr) return res.status(409).json({ error: "unavailable" });
        p = vr.p;
        n = `${m.n} (${vr.k})`;
        vk = vr.k;
      }
      if (!p || !(q >= 1 && q <= 20)) continue;
      items.push({ id: m.id, v: vk, n, q, p });
      total += q * p; // harga selalu dari server
    }
    const tb = await tableByCode(b.code); // meja ditentukan server dari kode QR, bukan dari isian pelanggan
    if (!tb) return res.status(400).json({ error: "table" });
    const table = tb.t;
    if (!(await limit("rl:ordtb:" + table, 40, 600)))
      return res.status(429).json({ error: "too_many" });
    const id = newId();
    const sec = newSecret();
    const o = {
      id,
      name: clean(b.name, 30) || "Tamu",
      table,
      note: clean(b.note, 60),
      sh: sha(sec, "sha256"),
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
            id: String(i.id) + (i.v ? "-" + i.v : ""),
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
    res.json({ id, token, sec });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "server" });
  }
};
