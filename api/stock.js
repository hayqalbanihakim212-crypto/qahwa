// Khusus admin.
// GET                                          -> { menu, closed, food }
// POST { id, off }                             -> menu habis (off:true) atau tersedia (off:false)
// POST { id, k, off }                          -> satu varian (Panas/Dingin/Float) habis atau tersedia
// POST { cats:[...], closed }                  -> tutup atau buka kategori
// POST { action:"add", n, c, p, food?, v? }    -> tambah menu (p = harga, 0 = "Segera"; v = varian [{k,p}])
// POST { action:"edit", id, n?, p?, v? }       -> ubah nama dan harga; v:[...] = pakai varian, tanpa v = harga tunggal p
// POST { action:"del", id }                    -> hapus menu
// Semua POST membalas { menu, closed, food } terbaru.
const {
  getStockState,
  putStockState,
  buildMenu,
  isAdmin,
  sameOrigin,
} = require("./_lib");

const VK = ["Panas", "Dingin", "Float"];
const clean = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

// Varian dari admin: 2 sampai 3 entri, nama dari daftar tetap, tanpa duplikat, harga 1 sampai 1.000.000.
const parseV = (v) => {
  if (!Array.isArray(v) || v.length < 2 || v.length > VK.length) return null;
  const out = [];
  for (const z of v) {
    const k = String((z && z.k) ?? ""),
      p = Math.round(Number(z && z.p));
    if (!VK.includes(k) || out.some((x) => x.k === k) || !(p >= 1 && p <= 1e6))
      return null;
    out.push({ k, p });
  }
  return out.sort((a, b) => VK.indexOf(a.k) - VK.indexOf(b.k));
};

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
      bad = (code = 400, error = "bad") => res.status(code).json({ error });
    const dupe = (c, n, skip) =>
      s.items.some(
        (m) =>
          m.id !== skip &&
          m.c.toLowerCase() === c.toLowerCase() &&
          m.n.toLowerCase() === n.toLowerCase(),
      );

    if (b.action === "add") {
      const n = clean(b.n, 60),
        c = clean(b.c, 30),
        hasV = b.v !== undefined && b.v !== null,
        v = hasV ? parseV(b.v) : null,
        p = v ? Math.min(...v.map((z) => z.p)) : Math.round(Number(b.p));
      if (!n || !c || (hasV && !v) || !(p >= 0 && p <= 1e6)) return bad();
      if (s.items.length >= 500) return bad(409, "full");
      if (dupe(c, n)) return bad(409, "dupe");
      // pakai penulisan kategori yang sudah ada (misal "espresso" -> "Espresso")
      const known = s.items.find((m) => m.c.toLowerCase() === c.toLowerCase());
      const cat = known ? known.c : c;
      if (!known && b.food === true && !s.food.includes(cat)) s.food.push(cat);
      s.items.push({ id: s.nextId, c: cat, n, p, ...(v ? { v } : {}) });
      s.nextId++;
    } else if (b.action === "edit") {
      const m = s.items.find((x) => x.id === Number(b.id));
      if (!m) return bad(404, "not_found");
      const n = b.n === undefined ? m.n : clean(b.n, 60);
      if (!n) return bad();
      if (dupe(m.c, n, m.id)) return bad(409, "dupe");
      if (b.v !== undefined && b.v !== null) {
        const v = parseV(b.v);
        if (!v) return bad();
        // status habis per varian ikut terbawa untuk varian yang namanya sama
        const was = new Map((m.v || []).map((z) => [z.k, !!z.off]));
        m.v = v.map((z) => (was.get(z.k) ? { ...z, off: true } : z));
        m.p = Math.min(...v.map((z) => z.p));
        delete m.off;
      } else {
        const p = Math.round(Number(b.p));
        if (!(p >= 0 && p <= 1e6)) return bad();
        delete m.v;
        m.p = p;
      }
      m.n = n;
    } else if (b.action === "del") {
      const id = Number(b.id);
      if (!s.items.some((x) => x.id === id)) return bad(404, "not_found");
      s.items = s.items.filter((x) => x.id !== id);
      // kategori yang sudah kosong ikut dibersihkan dari daftar tutup dan daftar makanan
      const left = new Set(s.items.map((x) => x.c));
      s.closed = s.closed.filter((c) => left.has(c));
      s.food = s.food.filter((c) => left.has(c));
    } else if (b.id !== undefined) {
      const m = s.items.find((x) => x.id === Number(b.id));
      if (!m) return bad(404, "not_found");
      if (b.k !== undefined) {
        const z = (m.v || []).find((x) => x.k === b.k);
        if (!z) return bad(404, "not_found");
        if (b.off === true) z.off = true;
        else delete z.off;
      } else {
        if (b.off === true) m.off = true;
        else delete m.off;
        // menu bervarian: tombol habis/tersedia di tingkat menu berlaku untuk semua varian
        if (m.v)
          m.v = m.v.map(({ off, ...z }) =>
            b.off === true ? { ...z, off: true } : z,
          );
      }
    } else if (Array.isArray(b.cats)) {
      const known = new Set(s.items.map((m) => m.c));
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
