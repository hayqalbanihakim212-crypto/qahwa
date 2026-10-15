// GET = cek sesi, POST = masuk, DELETE = keluar
const { redis, ip, sameOrigin, limit, authConfigured, verifyPassword, startSession, endSession, isAdmin } = require("./_lib");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
module.exports = async (req, res) => {
  try {
    if (req.method === "GET") return (await isAdmin(req)) ? res.json({ ok: 1 }) : res.status(401).json({ error: "auth" });
    if (!["POST", "DELETE"].includes(req.method)) return res.status(405).end();
    if (!sameOrigin(req)) return res.status(403).json({ error: "origin" });
    if (req.method === "DELETE") { await endSession(req, res); return res.json({ ok: 1 }); }
    if (!authConfigured()) return res.status(503).json({ error: "not_configured" });
    const key = "rl:login:" + ip(req);
    if (!(await limit(key, 5, 900))) { res.setHeader("Retry-After", "900"); return res.status(429).json({ error: "too_many" }); }
    if (!verifyPassword((req.body || {}).password)) { await wait(600); return res.status(401).json({ error: "bad" }); }
    await redis("DEL", key);
    await startSession(req, res);
    res.json({ ok: 1 });
  } catch (e) { res.status(500).json({ error: "server" }); }
};
