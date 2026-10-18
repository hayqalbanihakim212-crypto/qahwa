/* Menu, stok, dan kategori ditutup. Harga selalu dipegang server.

   Daftar menu ada di tabel menu_items (Supabase). Tanpa Supabase (lokal) disimpan di kunci "cfg:items".
   Kalau tabel masih kosong atau belum dibuat, dipakai menu bawaan _menu.js (hanya baca) sampai admin menyimpan.
   Kategori ditutup, kategori makanan, dan nextId disimpan di kunci "cfg:stock":
     closed : nama kategori yang ditutup
     food   : kategori makanan buatan admin (selain bawaan di dashboard)
     nextId : penghitung id; id yang pernah dipakai tidak dipakai lagi, jadi riwayat pesanan tetap benar */
const BASE = require("../_menu");
const { STORAGE, kv, sb } = require("./store");

const BASE_MAX = BASE.reduce((m, x) => Math.max(m, x.id), 0);
const asArray = (a) => (Array.isArray(a) ? a : []);
const parseJson = (s, fallback) => {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch (e) {
    return fallback;
  }
};

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
  const a = parseJson(await kv("GET", "cfg:items"), null);
  return Array.isArray(a) && a.length ? a : null;
};

const saveItems = async (items) => {
  if (STORAGE !== "supabase")
    return kv("SET", "cfg:items", JSON.stringify(items));
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

/* Migrasi format lama: dulu menu habis (off), menu tambahan (added), dan menu terhapus (removed)
   disimpan di cfg:stock. Digabung di memori; tersimpan ke tabel pada penyimpanan admin berikutnya. */
const applyLegacy = (items, s) => {
  const removed = asArray(s.removed).map(Number),
    off = asArray(s.off).map(Number),
    added = asArray(s.added);
  if (!removed.length && !off.length && !added.length) return items;
  items = items.filter((m) => !removed.includes(m.id));
  for (const a of added)
    if (a && !items.some((m) => m.id === a.id))
      items.push({ id: a.id, c: a.c, n: a.n, p: a.p });
  return items.map((m) => (off.includes(m.id) ? { ...m, off: true } : m));
};

const getStockState = async () => {
  const s = parseJson(await kv("GET", "cfg:stock"), {});
  // tabel masih kosong: pakai menu bawaan sampai admin menyimpan
  let items = (await loadItems()) || BASE.map((m) => ({ ...m }));
  items = applyLegacy(items, s);
  const maxId = items.reduce((m, x) => Math.max(m, x.id), BASE_MAX);
  return {
    items,
    closed: asArray(s.closed).map(String),
    food: asArray(s.food).map(String),
    nextId: Math.max(Number(s.nextId) || 0, maxId + 1),
  };
};

const putStockState = async (s) => {
  await saveItems(s.items);
  await kv(
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

// Bentuk yang dikirim ke klien: menu + kategori ditutup (hanya yang masih ada) + kategori makanan
const stockView = (s) => {
  const menu = buildMenu(s),
    cats = new Set(menu.map((m) => m.c));
  return { menu, closed: s.closed.filter((c) => cats.has(c)), food: s.food };
};

const getMenu = async () => {
  let s;
  try {
    s = await getStockState();
  } catch (e) {
    // database gagal: pelanggan tetap melihat menu bawaan (hanya baca, tidak menyimpan apa pun)
    console.error("stock state", e.message);
    s = { items: BASE.map((m) => ({ ...m })), closed: [], food: [], nextId: 0 };
  }
  const { menu, closed } = stockView(s);
  return { menu, closed, food: s.food };
};

module.exports = { getStockState, putStockState, buildMenu, stockView, getMenu };
