// GET = cek sesi, POST = masuk, DELETE = keluar
const {
  kv,
  ip,
  handle,
  allow,
  HttpError,
  requireSameOrigin,
  rateLimit,
  authConfigured,
  verifyPassword,
  startSession,
  endSession,
  isAdmin,
} = require("./_lib");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LOGIN_WINDOW = 900; // detik
const RETRY_AFTER = { "Retry-After": String(LOGIN_WINDOW) };

module.exports = handle(async (req, res) => {
  if (req.method === "GET") {
    if (!(await isAdmin(req))) throw new HttpError(401, "auth");
    return res.json({ ok: 1 });
  }
  allow(req, "POST", "DELETE");
  requireSameOrigin(req);

  if (req.method === "DELETE") {
    await endSession(req, res);
    return res.json({ ok: 1 });
  }

  if (!authConfigured()) throw new HttpError(503, "not_configured");
  const key = "rl:login:" + ip(req);
  await rateLimit(key, 5, LOGIN_WINDOW, RETRY_AFTER); // per alamat IP
  await rateLimit("rl:login:all", 40, LOGIN_WINDOW, RETRY_AFTER); // seluruh pengunjung
  if (!verifyPassword((req.body || {}).password)) {
    await wait(600); // memperlambat tebakan password
    throw new HttpError(401, "bad");
  }
  await kv("DEL", key);
  await startSession(req, res);
  res.json({ ok: 1 });
});
