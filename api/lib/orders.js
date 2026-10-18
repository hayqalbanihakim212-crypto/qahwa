/* Pesanan: antrian langsung di kv (kedaluwarsa 30 hari) + arsip permanen di tabel "orders" (Supabase,
   dibuat oleh supabase.sql). */
const { STORAGE, kv, sb } = require("./store");

const ORDER_TTL = 30 * 24 * 3600; // detik
const INDEX_KEY = "orders"; // daftar ID pesanan terbaru
const INDEX_KEEP = 500;

const getOrder = async (id) => {
  const v = await kv("GET", "order:" + id);
  return v ? JSON.parse(v) : null;
};

// Buang rahasia (hash) sebelum dikirim ke admin
const publicOrder = ({ sh, ...rest }) => rest;

/* Tiap perubahan pesanan juga disalin ke arsip. Kalau arsip gagal, pesanan pelanggan tetap jalan;
   kesalahan dicatat di log. */
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
  await kv("SET", "order:" + o.id, JSON.stringify(o), "EX", ORDER_TTL);
  await archive(o);
};

// Pesanan baru: simpan + masukkan ke daftar terbaru
const createOrder = async (o) => {
  await putOrder(o);
  await kv("LPUSH", INDEX_KEY, o.id);
  await kv("LTRIM", INDEX_KEY, 0, INDEX_KEEP - 1);
};

// `count` pesanan terbaru dari antrian langsung (terbaru dulu), tanpa rahasia
const recentOrders = async (count) => {
  const ids = await kv("LRANGE", INDEX_KEY, 0, count - 1);
  const vals = ids.length
    ? await kv("MGET", ...ids.map((i) => "order:" + i))
    : [];
  return vals.filter(Boolean).map((v) => publicOrder(JSON.parse(v)));
};

const rowToOrder = (r) => ({
  id: r.id,
  ts: Number(r.ts),
  status: r.status,
  table: r.tbl,
  name: r.name || "",
  note: r.note || "",
  total: r.total,
  items: r.items || [],
});

/* Daftar pesanan sejak waktu tertentu (milidetik), terbaru dulu, untuk Statistik dan Riwayat admin.
   Supabase: dari arsip permanen (maks `cap` baris). Mode lokal: dari 500 pesanan terbaru. */
const listOrders = async (since = 0, cap = 5000) => {
  since = Math.max(0, Math.floor(Number(since)) || 0);
  if (STORAGE !== "supabase")
    return (await recentOrders(INDEX_KEEP)).filter((o) => Number(o.ts) >= since);
  const PAGE = 1000;
  const out = [];
  for (let off = 0; off < cap; off += PAGE) {
    const rows = await sb(
      "GET",
      `orders?ts=gte.${since}&select=id,ts,status,tbl,name,note,total,items&order=ts.desc&offset=${off}&limit=${PAGE}`,
    );
    out.push(...rows.map(rowToOrder));
    if (rows.length < PAGE) break;
  }
  return out;
};

module.exports = { getOrder, putOrder, createOrder, recentOrders, listOrders };
