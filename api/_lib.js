const crypto = require("crypto");

/* ---------- Mode pembayaran: mock | sandbox | production (default mock, paling aman) ---------- */
const REQ_MODE = ["mock", "sandbox", "production"].includes(
  process.env.PAYMENT_MODE,
)
  ? process.env.PAYMENT_MODE
  : "mock";

const MODE =
  REQ_MODE === "mock" &&
  process.env.VERCEL_ENV === "production" &&
  process.env.ALLOW_MOCK !== "1"
    ? "locked"
    : REQ_MODE;

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
  if (MODE === "locked") return "Mode mock dikunci di production.";
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
const BASE = require("./_menu"); // menu bawaan (statis). Perubahan admin disimpan di Redis, bukan di file ini.

/* ---------- Penyimpanan: Supabase; tanpa Supabase hanya boleh di komputer lokal (memori sementara) ---------- */
const SB = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SK = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(); // hanya di server, jangan pernah dikirim ke browser; spasi tempelan dibuang
/* Mode penyimpanan:
   - "supabase": SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terisi.
   - "local"   : tanpa Supabase (pengembangan). Data disimpan di file .data/local.json di komputer ini,
                 jadi tidak hilang saat server dijalankan ulang. Paksa dengan STORAGE_MODE=local di .env
                 (berguna untuk `vercel dev`, yang selalu menganggap dirinya di Vercel).
   - "none"    : sedang di Vercel tanpa Supabase. Semua akses penyimpanan menolak dengan pesan jelas. */
const forceLocal =
  process.env.STORAGE_MODE === "local" &&
  process.env.VERCEL_ENV !== "production";
const STORAGE =
  SB && SK && !forceLocal
    ? "supabase"
    : process.env.VERCEL && !forceLocal
      ? "none"
      : "local";
const fs = require("fs");
const path = require("path");
const LOCAL_FILE =
  process.env.LOCAL_DB_FILE || path.join(process.cwd(), ".data", "local.json");
const mem = { kv: new Map(), ls: new Map() };
let lastM = 0;
// Muat ulang dari file kalau file berubah (mungkin ditulis proses/fungsi lain).
// Kunci "rl:" (pembatas percobaan) hanya di memori dan tidak disimpan.
const loadLocal = () => {
  if (STORAGE !== "local") return;
  try {
    const m = fs.statSync(LOCAL_FILE).mtimeMs;
    if (m === lastM) return;
    lastM = m;
    const d = JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8"));
    const now = Date.now();
    for (const k of [...mem.kv.keys()])
      if (!k.startsWith("rl:")) mem.kv.delete(k);
    mem.ls.clear();
    for (const [k, e] of d.kv || []) if (!e.x || e.x > now) mem.kv.set(k, e);
    for (const [k, l] of d.ls || []) mem.ls.set(k, l);
  } catch (e) {} // belum ada file = mulai kosong
};
const saveLocal = () => {
  if (STORAGE !== "local") return;
  try {
    fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
    const data = {
      kv: [...mem.kv].filter(([k]) => !k.startsWith("rl:")),
      ls: [...mem.ls],
    };
    const tmp = LOCAL_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, LOCAL_FILE);
    lastM = fs.statSync(LOCAL_FILE).mtimeMs;
  } catch (e) {
    console.error("simpan lokal gagal:", e.message);
  }
};
const memRedis = (c, ...a) => {
  loadLocal();
  const r = memRedisRaw(c, ...a);
  const rl = typeof a[0] === "string" && a[0].startsWith("rl:");
  if (!rl && c !== "GET" && c !== "LRANGE" && c !== "MGET") saveLocal();
  return r;
};
const memRedisRaw = (c, ...a) => {
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
    case "INCREX": {
      const e = get(k),
        n = (e ? +e.v : 0) + 1;
      mem.kv.set(k, { v: String(n), x: e ? e.x : now + v * 1000 });
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
/* Supabase (Postgres) lewat REST. Tabel dan fungsi dibuat oleh supabase.sql.
   Nama fungsi "redis" dipertahankan supaya file api lain tidak perlu diubah. */
const sb = async (method, path, body, extra = {}) => {
  const r = await fetch(SB + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: SK,
      // kunci service_role lama berbentuk JWT (eyJ...) dan dikirim juga sebagai Bearer;
      // kunci baru sb_secret_... cukup lewat header apikey
      ...(SK.startsWith("eyJ") ? { Authorization: "Bearer " + SK } : {}),
      "Content-Type": "application/json",
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error("Supabase " + r.status + ": " + t.slice(0, 120));
  return t ? JSON.parse(t) : null;
};
const q = encodeURIComponent;
const live = (row) => !!row && (!row.exp || new Date(row.exp) > new Date());
const inFuture = (sec) => new Date(Date.now() + sec * 1000).toISOString();
const sbRedis = async (c, ...a) => {
  const [k, v] = a;
  switch (c) {
    case "GET": {
      const rows = await sb("GET", `kv?k=eq.${q(k)}&select=v,exp`);
      return live(rows[0]) ? rows[0].v : null;
    }
    case "SET": {
      const i = a.indexOf("EX");
      await sb(
        "POST",
        "kv?on_conflict=k",
        { k, v, exp: i > 0 ? inFuture(+a[i + 1]) : null },
        { Prefer: "resolution=merge-duplicates" },
      );
      return "OK";
    }
    case "DEL":
      await sb("DELETE", `kv?k=eq.${q(k)}`);
      return 1;
    case "INCR":
      return Number(await sb("POST", "rpc/kv_incr", { p_key: k }));
    case "INCREX":
      return Number(
        await sb("POST", "rpc/kv_incr_ex", { p_key: k, p_ttl: +v }),
      );
    case "EXPIRE":
      await sb("PATCH", `kv?k=eq.${q(k)}`, { exp: inFuture(+v) });
      return 1;
    case "LPUSH":
      await sb("POST", "kv_list", { k, v });
      return 1;
    case "LTRIM":
      await sb("POST", "rpc/kv_ltrim", { p_key: k, p_keep: +a[2] + 1 });
      return "OK";
    case "LRANGE": {
      const s = +a[1],
        n = +a[2] - s + 1;
      const rows = await sb(
        "GET",
        `kv_list?k=eq.${q(k)}&select=v&order=id.desc&offset=${s}&limit=${n}`,
      );
      return rows.map((x) => x.v);
    }
    case "MGET": {
      if (!a.length) return [];
      const rows = await sb(
        "GET",
        `kv?k=in.(${a.map((x) => q('"' + x + '"')).join(",")})&select=k,v,exp`,
      );
      const m = new Map(rows.filter(live).map((x) => [x.k, x.v]));
      return a.map((x) => m.get(x) ?? null);
    }
  }
  throw new Error("cmd");
};
const redis = async (...cmd) => {
  if (STORAGE === "none") throw new Error("Supabase belum dihubungkan");
  if (STORAGE === "local") return memRedis(...cmd);
  return sbRedis(...cmd);
};
const getOrder = async (id) => {
  const v = await redis("GET", "order:" + id);
  return v ? JSON.parse(v) : null;
};
/* Arsip permanen: tiap perubahan pesanan juga disalin ke tabel "orders" di Supabase (dibuat oleh
   supabase_orders.sql). Kalau arsip gagal, pesanan pelanggan tetap jalan; kesalahan dicatat di log. */
const archive = async (o) => {
  if (STORAGE !== "supabase") return;
  try {
    await sb(
      "POST",
      "orders?on_conflict=id",
      {
        id: o.id,
        ts: Math.floor(Number(o.ts)) || Date.now(),
        status: String(o.status),
        tbl: o.table == null ? null : String(o.table),
        name: o.name || null,
        note: o.note || null,
        total: Math.round(Number(o.total)) || 0,
        items: Array.isArray(o.items) ? o.items : [],
        updated_at: new Date().toISOString(),
      },
      { Prefer: "resolution=merge-duplicates" },
    );
  } catch (e) {
    console.error("arsip pesanan gagal:", e.message);
  }
};
const putOrder = async (o) => {
  await redis("SET", "order:" + o.id, JSON.stringify(o), "EX", 2592000);
  await archive(o);
};
/* Daftar pesanan sejak waktu tertentu (milidetik), terbaru dulu, untuk Statistik dan Riwayat admin.
   Supabase: dari arsip permanen (maks 5000 baris). Mode lokal: dari 500 pesanan terbaru. */
const listOrders = async (since = 0, cap = 5000) => {
  since = Math.max(0, Math.floor(Number(since)) || 0);
  if (STORAGE !== "supabase") {
    const ids = await redis("LRANGE", "orders", 0, 499);
    const vals = ids.length
      ? await redis("MGET", ...ids.map((i) => "order:" + i))
      : [];
    return vals
      .filter(Boolean)
      .map((v) => {
        const o = JSON.parse(v);
        delete o.sh;
        return o;
      })
      .filter((o) => Number(o.ts) >= since);
  }
  const out = [];
  for (let off = 0; off < cap; off += 1000) {
    const rows = await sb(
      "GET",
      `orders?ts=gte.${since}&select=id,ts,status,tbl,name,note,total,items&order=ts.desc&offset=${off}&limit=1000`,
    );
    for (const r of rows)
      out.push({
        id: r.id,
        ts: Number(r.ts),
        status: r.status,
        table: r.tbl,
        name: r.name || "",
        note: r.note || "",
        total: r.total,
        items: r.items || [],
      });
    if (rows.length < 1000) break;
  }
  return out;
};

/* ---------- Stok & menu yang diatur admin ----------
   Satu kunci Redis "cfg:stock" menyimpan:
   off     : id menu yang habis
   closed  : nama kategori yang ditutup
   added   : menu baru dari admin [{id,c,n,p}]
   removed : id menu bawaan (_menu.js) yang dihapus
   food    : kategori makanan buatan admin (selain bawaan di dashboard)
   nextId  : penghitung id; id yang pernah dipakai tidak dipakai lagi, jadi riwayat pesanan tetap benar */
const BASE_MAX = BASE.reduce((m, x) => Math.max(m, x.id), 0);
/* Daftar menu disimpan di tabel menu_items (Supabase). Tanpa Supabase (lokal) disimpan di kunci "cfg:items".
   Kalau tabel masih kosong atau belum dibuat, dipakai menu bawaan _menu.js (hanya baca) sampai admin menyimpan. */
const rowToItem = (r) => {
  const m = { id: r.id, c: r.c, n: r.n, p: r.p };
  if (Array.isArray(r.v) && r.v.length)
    m.v = r.v.map((z) => ({ k: z.k, p: z.p, ...(z.off ? { off: true } : {}) }));
  if (r.off) m.off = true;
  return m;
};
const loadItems = async () => {
  // Error dilempar (tidak ditelan): kalau ditelan, admin bisa menimpa menu di database dengan menu bawaan.
  if (STORAGE === "supabase") {
    const rows = await sb(
      "GET",
      "menu_items?select=*&order=pos.asc,id.asc&limit=1000",
    );
    return Array.isArray(rows) && rows.length ? rows.map(rowToItem) : null;
  }
  const v = await redis("GET", "cfg:items");
  try {
    const a = v ? JSON.parse(v) : null;
    return Array.isArray(a) && a.length ? a : null;
  } catch (e) {
    return null;
  }
};
const saveItems = async (items) => {
  if (STORAGE !== "supabase")
    return redis("SET", "cfg:items", JSON.stringify(items));
  const now = new Date().toISOString();
  const rows = items.map((m, i) => ({
    id: m.id,
    c: m.c,
    n: m.n,
    p: m.p,
    v: m.v || null,
    off: !!m.off,
    pos: i + 1,
    updated_at: now,
  }));
  await sb("POST", "menu_items?on_conflict=id", rows, {
    Prefer: "resolution=merge-duplicates,return=minimal",
  });
  await sb(
    "DELETE",
    `menu_items?id=not.in.(${items.map((m) => m.id).join(",")})`,
  );
};
const getStockState = async () => {
  let s = {};
  const v = await redis("GET", "cfg:stock");
  try {
    s = v ? JSON.parse(v) : {};
  } catch (e) {
    s = {};
  }
  const arr = (a) => (Array.isArray(a) ? a : []);
  let items = await loadItems();
  if (!items) items = BASE.map((m) => ({ ...m })); // tabel masih kosong: pakai menu bawaan sampai admin menyimpan
  /* Migrasi format lama: dulu menu habis (off), menu tambahan (added), dan menu terhapus (removed) disimpan
     di cfg:stock. Digabung di memori; tersimpan ke tabel pada penyimpanan admin berikutnya. */
  const rem = arr(s.removed).map(Number),
    off = arr(s.off).map(Number),
    add = arr(s.added);
  if (rem.length || off.length || add.length) {
    items = items.filter((m) => !rem.includes(m.id));
    for (const a of add)
      if (a && !items.some((m) => m.id === a.id))
        items.push({ id: a.id, c: a.c, n: a.n, p: a.p });
    items = items.map((m) => (off.includes(m.id) ? { ...m, off: true } : m));
  }
  const maxId = items.reduce((m, x) => Math.max(m, x.id), BASE_MAX);
  return {
    items,
    closed: arr(s.closed).map(String),
    food: arr(s.food).map(String),
    nextId: Math.max(Number(s.nextId) || 0, maxId + 1),
  };
};
// daftar menu ke tabel menu_items; kategori ditutup, kategori makanan, dan nextId tetap di kv (cfg:stock)
const putStockState = async (s) => {
  await saveItems(s.items);
  await redis(
    "SET",
    "cfg:stock",
    JSON.stringify({ closed: s.closed, food: s.food, nextId: s.nextId }),
  );
};
// Menu gabungan. Harga item bervarian = varian tersedia termurah; semua varian habis = item habis.
const buildMenu = (s) =>
  s.items.map((m) => {
    const o = { ...m };
    if (o.v && o.v.length) {
      const ok = o.v.filter((z) => !z.off);
      if (!ok.length) o.off = true;
      else o.p = Math.min(...ok.map((z) => z.p));
    }
    return o;
  });
const getMenu = async () => {
  let s;
  try {
    s = await getStockState();
  } catch (e) {
    // database gagal: pelanggan tetap melihat menu bawaan (hanya baca, tidak menyimpan apa pun)
    console.error("stock state", e.message);
    s = { items: BASE.map((m) => ({ ...m })), closed: [], food: [], nextId: 0 };
  }
  const menu = buildMenu(s);
  const cats = new Set(menu.map((m) => m.c));
  return { menu, closed: s.closed.filter((c) => cats.has(c)), food: s.food };
};

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
const clean = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
// Rahasia per pesanan: hanya hash-nya yang disimpan di server
const newSecret = () => crypto.randomBytes(24).toString("base64url"); // 32 karakter
const SEC_RE = /^[A-Za-z0-9_-]{32}$/;
const secOk = (o, s) =>
  SEC_RE.test(String(s || "")) &&
  !!o.sh &&
  safeEq(sha(String(s), "sha256"), o.sh);
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
  const sf = req.headers["sec-fetch-site"];
  if (sf && sf !== "same-origin") return false;
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch (e) {
    return false;
  }
};
const limit = async (key, max, sec) => (await redis("INCREX", key, sec)) <= max;

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
  STORAGE,
  MODE,
  MT,
  basic,
  getMenu,
  getStockState,
  putStockState,
  buildMenu,
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
  newSecret,
  secOk,
  clean,
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
  listOrders,
};
