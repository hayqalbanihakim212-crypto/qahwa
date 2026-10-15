const crypto = require("crypto");

/* ---------- Mode pembayaran: mock | sandbox | production (default mock, paling aman) ---------- */
const MODE = ["mock", "sandbox", "production"].includes(
  process.env.PAYMENT_MODE,
)
  ? process.env.PAYMENT_MODE
  : "mock";
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || "";
const CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || "";
const prod = MODE === "production";
const MT = {
  snap: prod
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions",
  api: prod
    ? "https://api.midtrans.com/v2"
    : "https://api.sandbox.midtrans.com/v2",
  js: prod
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js",
};
const basic = "Basic " + Buffer.from(SERVER_KEY + ":").toString("base64");
// Cegah salah pasang kunci: sandbox wajib kunci SB-, production wajib kunci non-SB
const configError = () => {
  if (MODE === "mock") return null;
  if (!SERVER_KEY || !CLIENT_KEY) return "Kunci Midtrans belum diisi.";
  if (
    (MODE === "sandbox") !==
    (SERVER_KEY.startsWith("SB-") && CLIENT_KEY.startsWith("SB-"))
  )
    return "Kunci Midtrans tidak cocok dengan PAYMENT_MODE.";
  return null;
};

/* ---------- Menu: harga dipegang server ---------- */
const MENU = require("./_menu");

/* ---------- Penyimpanan: Upstash Redis; tanpa Redis hanya boleh di komputer lokal (memori sementara) ---------- */
const RU = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RT =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const mem = { kv: new Map(), ls: new Map() };
const memRedis = (c, ...a) => {
  const [k, v] = a,
    now = Date.now();
  const get = (key) => {
    const e = mem.kv.get(key);
    if (e && e.x && e.x < now) {
      mem.kv.delete(key);
      return null;
    }
    return e || null;
  };
  switch (c) {
    case "GET":
      return get(k)?.v ?? null;
    case "SET": {
      const i = a.indexOf("EX");
      mem.kv.set(k, { v, x: i > 0 ? now + a[i + 1] * 1000 : 0 });
      return "OK";
    }
    case "DEL":
      mem.kv.delete(k);
      return 1;
    case "INCR": {
      const e = get(k),
        n = (e ? +e.v : 0) + 1;
      mem.kv.set(k, { v: String(n), x: e ? e.x : 0 });
      return n;
    }
    case "EXPIRE": {
      const e = get(k);
      if (e) e.x = now + v * 1000;
      return e ? 1 : 0;
    }
    case "LPUSH": {
      const l = mem.ls.get(k) || [];
      l.unshift(v);
      mem.ls.set(k, l);
      return l.length;
    }
    case "LTRIM":
      mem.ls.set(k, (mem.ls.get(k) || []).slice(+a[1], +a[2] + 1));
      return "OK";
    case "LRANGE":
      return (mem.ls.get(k) || []).slice(+a[1], +a[2] + 1);
    case "MGET":
      return a.map((x) => get(x)?.v ?? null);
  }
  throw new Error("cmd");
};
const redis = async (...cmd) => {
  if (!RU || !RT) {
    if (process.env.VERCEL) throw new Error("Redis belum dihubungkan");
    return memRedis(...cmd);
  }
  const r = await fetch(RU, {
    method: "POST",
    headers: { Authorization: "Bearer " + RT },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
};
const getOrder = async (id) => {
  const v = await redis("GET", "order:" + id);
  return v ? JSON.parse(v) : null;
};
const putOrder = (o) =>
  redis("SET", "order:" + o.id, JSON.stringify(o), "EX", 2592000);

/* ---------- Meja: pemilik mengatur jumlah meja; tiap meja punya kode acak yang ditanam di QR-nya ----------
   Pelanggan tidak memilih meja. Server yang menentukan meja dari kode QR, jadi meja tidak bisa dipalsukan. */
const TAKEAWAY = "Bawa pulang";
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
const newCode = () =>
  Array.from(
    crypto.randomBytes(8),
    (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32],
  ).join("");
const getTables = async () => {
  // [{ t: "5", k: "KODE8HURUF" }, ...] ; kosong = pemilik belum mengatur meja
  const v = await redis("GET", "cfg:tables");
  try {
    const a = v ? JSON.parse(v) : [];
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
};
async function setTables(n, takeaway) {
  // kode meja yang sudah ada dipertahankan, jadi QR cetakan lama tetap berlaku saat jumlah ditambah
  const keep = new Map((await getTables()).map((x) => [x.t, x.k]));
  const names = Array.from({ length: n }, (_, i) => String(i + 1));
  if (takeaway) names.push(TAKEAWAY);
  const list = names.map((t) => ({ t, k: keep.get(t) || newCode() }));
  await redis("SET", "cfg:tables", JSON.stringify(list));
  return list;
}
const tableByCode = async (c) => {
  c = String(c || "").toUpperCase();
  return CODE_RE.test(c)
    ? (await getTables()).find((x) => x.k === c) || null
    : null;
};

/* ---------- Utilitas keamanan ---------- */
const sha = (s, alg = "sha512") =>
  crypto.createHash(alg).update(s).digest("hex");
const safeEq = (a, b) => {
  a = Buffer.from(String(a));
  b = Buffer.from(String(b));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const ID_RE = /^QHW-[A-Z2-9]{8}$/;
const newId = () =>
  "QHW-" +
  Array.from(
    crypto.randomBytes(8),
    (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32],
  ).join("");
const ip = (req) =>
  String(
    req.headers["x-real-ip"] ||
      (req.headers["x-forwarded-for"] || "").split(",")[0] ||
      req.socket?.remoteAddress ||
      "?",
  )
    .trim()
    .slice(0, 45);
// Permintaan yang mengubah data wajib datang dari halaman situs ini sendiri (anti CSRF)
const sameOrigin = (req) => {
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch (e) {
    return false;
  }
};
const limit = async (key, max, sec) => {
  const n = await redis("INCR", key);
  if (n === 1) await redis("EXPIRE", key, sec);
  return n <= max;
};

/* ---------- Login admin & sesi (cookie HttpOnly, disimpan di server, bisa dicabut) ---------- */
const COOKIE = "qa_session",
  TTL = 8 * 3600,
  SID_RE = /^[0-9a-f]{64}$/;
// Password polos (ADMIN_PASSWORD) hanya untuk komputer lokal: tidak berlaku di production maupun di Vercel
const plainOk = () =>
  !prod && !process.env.VERCEL && !!process.env.ADMIN_PASSWORD;
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
const setCookie = (req, res, v, age) => {
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(req.headers.host || "");
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${v}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${age}${local ? "" : "; Secure"}`,
  );
};
async function startSession(req, res) {
  const sid = crypto.randomBytes(32).toString("hex");
  await redis("SET", "sess:" + sha(sid, "sha256"), "1", "EX", TTL);
  setCookie(req, res, sid, TTL);
}
async function endSession(req, res) {
  const sid = sidOf(req);
  if (sid) await redis("DEL", "sess:" + sha(sid, "sha256"));
  setCookie(req, res, "", 0);
}
const isAdmin = async (req) => {
  const sid = sidOf(req);
  return !!sid && !!(await redis("GET", "sess:" + sha(sid, "sha256")));
};

/* ---------- Status Midtrans -> status pesanan. Hanya "pending" yang boleh diubah oleh pembayaran ---------- */
const mapStatus = (t, f) =>
  t === "settlement" || (t === "capture" && f === "accept")
    ? "paid"
    : ["deny", "cancel", "expire", "failure"].includes(t)
      ? "failed"
      : null;
async function applyMidtrans(o, t, f) {
  const s = mapStatus(t, f);
  if (s && o.status === "pending") {
    o.status = s;
    await putOrder(o);
  }
  return o;
}
async function sync(o) {
  // cek langsung ke Midtrans (server ke server), jadi status benar walau webhook telat
  if (MODE === "mock" || o.status !== "pending") return o;
  try {
    const r = await fetch(MT.api + "/" + o.id + "/status", {
      headers: { Authorization: basic, Accept: "application/json" },
    });
    const j = await r.json();
    return await applyMidtrans(o, j.transaction_status, j.fraud_status);
  } catch (e) {
    return o;
  }
}

module.exports = {
  MODE,
  MT,
  basic,
  MENU,
  SERVER_KEY,
  CLIENT_KEY,
  configError,
  redis,
  getOrder,
  putOrder,
  TAKEAWAY,
  getTables,
  setTables,
  tableByCode,
  sha,
  safeEq,
  ID_RE,
  newId,
  ip,
  sameOrigin,
  limit,
  authConfigured,
  verifyPassword,
  startSession,
  endSession,
  isAdmin,
  applyMidtrans,
  sync,
};
