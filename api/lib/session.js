/* Login admin dan sesi: cookie HttpOnly, disimpan di server, bisa dicabut. */
const crypto = require("crypto");
const { PROD } = require("./config");
const { kv } = require("./store");
const { sha, safeEq } = require("./security");

const COOKIE = "qa_session",
  TTL = 8 * 3600,
  SID_RE = /^[0-9a-f]{64}$/;

// Password polos (ADMIN_PASSWORD) hanya untuk komputer lokal: tidak berlaku di production maupun di Vercel
const plainOk = () =>
  !PROD && !process.env.VERCEL && !!process.env.ADMIN_PASSWORD;
const authConfigured = () => !!process.env.ADMIN_PASSWORD_HASH || plainOk();

function verifyPassword(input) {
  input = String(input || "").slice(0, 200);
  const H = process.env.ADMIN_PASSWORD_HASH,
    P = process.env.ADMIN_PASSWORD;
  if (H) {
    const [alg, salt, hash] = H.split(":");
    if (alg !== "scrypt" || !salt || !hash) return false;
    return safeEq(
      crypto.scryptSync(input, Buffer.from(salt, "hex"), 64).toString("hex"),
      hash,
    );
  }
  return plainOk() && safeEq(sha(input, "sha256"), sha(P, "sha256"));
}

const sidOf = (req) => {
  const m = (req.headers.cookie || "")
    .split(/;\s*/)
    .find((c) => c.startsWith(COOKIE + "="));
  const v = m ? m.slice(COOKIE.length + 1) : "";
  return SID_RE.test(v) ? v : "";
};
const sessKey = (sid) => "sess:" + sha(sid, "sha256");

const setCookie = (req, res, value, maxAge) => {
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(req.headers.host || "");
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${maxAge}${local ? "" : "; Secure"}`,
  );
};
async function startSession(req, res) {
  const sid = crypto.randomBytes(32).toString("hex");
  await kv("SET", sessKey(sid), "1", "EX", TTL);
  setCookie(req, res, sid, TTL);
}
async function endSession(req, res) {
  const sid = sidOf(req);
  if (sid) await kv("DEL", sessKey(sid));
  setCookie(req, res, "", 0);
}
const isAdmin = async (req) => {
  const sid = sidOf(req);
  return !!sid && !!(await kv("GET", sessKey(sid)));
};

module.exports = {
  authConfigured,
  verifyPassword,
  startSession,
  endSession,
  isAdmin,
};
