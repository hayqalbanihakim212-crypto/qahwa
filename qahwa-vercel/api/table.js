// GET ?c=KODE   (publik)  -> { t: "5" }  nama meja untuk kode di QR; 404 jika kode tidak dikenal
// GET            (admin)  -> { tables: [{ t, k }] }  daftar meja beserta kode QR-nya
// POST {count, takeaway} (admin) -> atur jumlah meja (1-60), opsional QR "Bawa pulang"
const { getTables, setTables, tableByCode, isAdmin, sameOrigin, ip, limit } = require("./_lib");
module.exports = async (req, res) => {
  try {
    if (req.method === "GET" && req.query.c !== undefined) {
      if (!(await limit("rl:table:" + ip(req), 120, 600))) return res.status(429).json({ error: "too_many" });
      const tb = await tableByCode(req.query.c);
      return tb ? res.json({ t: tb.t }) : res.status(404).json({ error: "not_found" }); // hanya nama meja; kode lain tidak pernah dikirim ke publik
    }
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth" });
    if (req.method === "GET") return res.json({ tables: await getTables() });
    if (req.method !== "POST") return res.status(405).end();
    if (!sameOrigin(req)) return res.status(403).json({ error: "origin" });
    const b = req.body || {}, n = Math.floor(Number(b.count));
    if (!(n >= 1 && n <= 60)) return res.status(400).json({ error: "bad" });
    res.json({ tables: await setTables(n, b.takeaway === true) });
  } catch (e) { res.status(500).json({ error: "server" }); }
};
