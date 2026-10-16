// Khusus admin.
// GET                                   -> { menu, closed, food }
// POST { id, off }                      -> tandai satu menu habis (off:true) atau tersedia (off:false)
// POST { cats:[...], closed }           -> tutup atau buka kategori
// POST { action:"add", n, c, p, food? } -> tambah menu baru (p = harga, 0 = "Segera")
// POST { action:"del", id }             -> hapus menu
// Semua POST membalas { menu, closed, food } terbaru.
const {
  getStockState,
  putStockState,
  buildMenu,
  isAdmin,
  sameOrigin,
} = require("./_lib");

const clean = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const view = (s) => {
  const menu = buildMenu(s),
    cats = new Set(menu.map((m) => m.c));
  return { menu, closed: s.closed.filter((c) => cats.has(c)), food: s.food };
};

module.exports = async (req, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth" });
    if (req.method === "GET") return res.json(view(await getStockState()));
    if (req.method !== "POST") return res.status(405).end();
    if (!sameOrigin(req)) return res.status(403).json({ error: "origin" });

    const b = req.body || {},
      s = await getStockState(),
      menu = buildMenu(s),
      bad = (code = 400, error = "bad") => res.status(code).json({ error });

    if (b.action === "add") {
      const n = clean(b.n, 60),
        c = clean(b.c, 30),
        p = Math.round(Number(b.p));
      if (!n || !c || !(p >= 0 && p <= 1e6)) return bad();
      if (menu.length >= 500) return bad(409, "full");
      if (
        menu.some(
          (m) =>
            m.c.toLowerCase() === c.toLowerCase() &&
            m.n.toLowerCase() === n.toLowerCase(),
        )
      )
        return bad(409, "dupe");
      // pakai penulisan kategori yang sudah ada (misal "espresso" -> "Espresso")
      const known = menu.find((m) => m.c.toLowerCase() === c.toLowerCase());
      const cat = known ? known.c : c;
      if (!known && b.food === true && !s.food.includes(cat)) s.food.push(cat);
      s.added.push({ id: s.nextId, c: cat, n, p });
      s.nextId++;
    } else if (b.action === "del") {
      const id = Number(b.id);
      const m = menu.find((x) => x.id === id);
      if (!m) return bad(404, "not_found");
      if (s.added.some((x) => x.id === id))
        s.added = s.added.filter((x) => x.id !== id);
      else if (!s.removed.includes(id)) s.removed.push(id);
      s.off = s.off.filter((x) => x !== id);
      // kategori yang sudah kosong ikut dibersihkan dari daftar tutup dan daftar makanan
      const left = new Set(buildMenu(s).map((x) => x.c));
      s.closed = s.closed.filter((c) => left.has(c));
      s.food = s.food.filter((c) => left.has(c));
    } else if (b.id !== undefined) {
      const id = Number(b.id);
      if (!menu.some((m) => m.id === id)) return bad(404, "not_found");
      s.off = s.off.filter((x) => x !== id);
      if (b.off === true) s.off.push(id);
    } else if (Array.isArray(b.cats)) {
      const known = new Set(menu.map((m) => m.c));
      const cats = b.cats.map(String).filter((c) => known.has(c));
      if (!cats.length) return bad();
      s.closed = s.closed.filter((c) => !cats.includes(c));
      if (b.closed === true) s.closed.push(...cats);
    } else return bad();

    await putStockState(s);
    res.json(view(s));
  } catch (e) {
    console.error(e.message);
    // detail hanya dikirim ke admin (sudah lolos isAdmin), supaya penyebab muncul di tab Stok
    res
      .status(500)
      .json({ error: "server", detail: String(e.message).slice(0, 160) });
  }
};
