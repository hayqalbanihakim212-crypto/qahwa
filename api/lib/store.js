/* Penyimpanan kunci-nilai. Satu fungsi `kv(perintah, ...args)` dengan perintah gaya Redis:
   GET SET(EX) DEL INCR INCREX EXPIRE LPUSH LTRIM LRANGE MGET.

   Mode penyimpanan (STORAGE):
   - "supabase": SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terisi.
   - "local"   : tanpa Supabase (pengembangan). Data disimpan di .data/local.json supaya tidak
                 hilang saat server dijalankan ulang. Paksa dengan STORAGE_MODE=local di .env
                 (berguna untuk `vercel dev`, yang selalu menganggap dirinya di Vercel).
   - "none"    : di Vercel tanpa Supabase. Semua akses ditolak dengan pesan jelas. */
const fs = require("fs");
const path = require("path");

const SB_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(); // hanya di server, jangan dikirim ke browser

const forceLocal =
  process.env.STORAGE_MODE === "local" &&
  process.env.VERCEL_ENV !== "production";
const STORAGE =
  SB_URL && SB_KEY && !forceLocal
    ? "supabase"
    : process.env.VERCEL && !forceLocal
      ? "none"
      : "local";

// Argumen "EX <detik>" pada SET -> detik, atau 0 kalau tidak ada
const ttlOf = (args) => {
  const i = args.indexOf("EX");
  return i > 0 ? Number(args[i + 1]) : 0;
};

/* ---------- Mode lokal: Map di memori + file JSON ---------- */
const LOCAL_FILE =
  process.env.LOCAL_DB_FILE || path.join(process.cwd(), ".data", "local.json");
const mem = { kv: new Map(), ls: new Map() };
let lastMtime = 0;
// Kunci "rl:" (pembatas percobaan) hanya di memori dan tidak pernah disimpan ke file.
const isRateKey = (k) => typeof k === "string" && k.startsWith("rl:");

// Muat ulang dari file kalau file berubah (mungkin ditulis proses/fungsi lain).
const loadLocal = () => {
  try {
    const m = fs.statSync(LOCAL_FILE).mtimeMs;
    if (m === lastMtime) return;
    lastMtime = m;
    const d = JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8"));
    const now = Date.now();
    for (const k of [...mem.kv.keys()]) if (!isRateKey(k)) mem.kv.delete(k);
    mem.ls.clear();
    for (const [k, e] of d.kv || []) if (!e.x || e.x > now) mem.kv.set(k, e);
    for (const [k, l] of d.ls || []) mem.ls.set(k, l);
  } catch (e) {} // belum ada file = mulai kosong
};
const saveLocal = () => {
  try {
    fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
    const data = {
      kv: [...mem.kv].filter(([k]) => !isRateKey(k)),
      ls: [...mem.ls],
    };
    const tmp = LOCAL_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, LOCAL_FILE);
    lastMtime = fs.statSync(LOCAL_FILE).mtimeMs;
  } catch (e) {
    console.error("simpan lokal gagal:", e.message);
  }
};
const localExec = (cmd, ...a) => {
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
  const list = (key) => mem.ls.get(key) || [];
  switch (cmd) {
    case "GET":
      return get(k)?.v ?? null;
    case "SET": {
      const ttl = ttlOf(a);
      mem.kv.set(k, { v, x: ttl ? now + ttl * 1000 : 0 });
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
      const l = list(k);
      l.unshift(v);
      mem.ls.set(k, l);
      return l.length;
    }
    case "LTRIM":
      mem.ls.set(k, list(k).slice(+a[1], +a[2] + 1));
      return "OK";
    case "LRANGE":
      return list(k).slice(+a[1], +a[2] + 1);
    case "MGET":
      return a.map((x) => get(x)?.v ?? null);
  }
  throw new Error("Perintah tidak dikenal: " + cmd);
};
const localKv = (cmd, ...a) => {
  loadLocal();
  const out = localExec(cmd, ...a);
  if (!isRateKey(a[0]) && !["GET", "LRANGE", "MGET"].includes(cmd)) saveLocal();
  return out;
};

/* ---------- Mode Supabase (Postgres lewat REST). Tabel dan fungsi dibuat oleh supabase.sql ---------- */
const sb = async (method, urlPath, body, extra = {}) => {
  const r = await fetch(SB_URL + "/rest/v1/" + urlPath, {
    method,
    headers: {
      apikey: SB_KEY,
      // kunci service_role lama berbentuk JWT (eyJ...) dan dikirim juga sebagai Bearer;
      // kunci baru sb_secret_... cukup lewat header apikey
      ...(SB_KEY.startsWith("eyJ") ? { Authorization: "Bearer " + SB_KEY } : {}),
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
const isLive = (row) => !!row && (!row.exp || new Date(row.exp) > new Date());
const inFuture = (sec) => new Date(Date.now() + sec * 1000).toISOString();

const supabaseKv = async (cmd, ...a) => {
  const [k, v] = a;
  switch (cmd) {
    case "GET": {
      const rows = await sb("GET", `kv?k=eq.${q(k)}&select=v,exp`);
      return isLive(rows[0]) ? rows[0].v : null;
    }
    case "SET": {
      const ttl = ttlOf(a);
      await sb(
        "POST",
        "kv?on_conflict=k",
        { k, v, exp: ttl ? inFuture(ttl) : null },
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
      const start = +a[1],
        count = +a[2] - start + 1;
      const rows = await sb(
        "GET",
        `kv_list?k=eq.${q(k)}&select=v&order=id.desc&offset=${start}&limit=${count}`,
      );
      return rows.map((x) => x.v);
    }
    case "MGET": {
      if (!a.length) return [];
      const rows = await sb(
        "GET",
        `kv?k=in.(${a.map((x) => q('"' + x + '"')).join(",")})&select=k,v,exp`,
      );
      const found = new Map(rows.filter(isLive).map((x) => [x.k, x.v]));
      return a.map((x) => found.get(x) ?? null);
    }
  }
  throw new Error("Perintah tidak dikenal: " + cmd);
};

const kv = async (...cmd) => {
  if (STORAGE === "none") throw new Error("Supabase belum dihubungkan");
  if (STORAGE === "local") return localKv(...cmd);
  return supabaseKv(...cmd);
};

module.exports = { STORAGE, kv, sb };
