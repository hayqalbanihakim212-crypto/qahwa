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
  handle,
  allow,
  HttpError,
  requireAdmin,
  requireSameOrigin,
  getStockState,
  putStockState,
  stockView,
  clean,
} = require("./_lib");

const VARIANT_KEYS = ["Panas", "Dingin", "Float"];
const MAX_ITEMS = 500;
const MAX_PRICE = 1e6;

const bad = () => new HttpError(400, "bad");
const notFound = () => new HttpError(404, "not_found");
const validPrice = (p, min) => p >= min && p <= MAX_PRICE;
const cheapest = (variants) => Math.min(...variants.map((z) => z.p));

// Varian dari admin: 2 sampai 3 entri, nama dari daftar tetap, tanpa duplikat, harga 1 sampai 1.000.000.
const parseVariants = (v) => {
  if (!Array.isArray(v) || v.length < 2 || v.length > VARIANT_KEYS.length)
    return null;
  const out = [];
  for (const z of v) {
    const k = String((z && z.k) ?? ""),
      p = Math.round(Number(z && z.p));
    if (!VARIANT_KEYS.includes(k) || out.some((x) => x.k === k) || !validPrice(p, 1))
      return null;
    out.push({ k, p });
  }
  return out.sort((a, b) => VARIANT_KEYS.indexOf(a.k) - VARIANT_KEYS.indexOf(b.k));
};

const hasValue = (v) => v !== undefined && v !== null;
const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
const isDuplicate = (s, cat, name, skipId) =>
  s.items.some((m) => m.id !== skipId && sameName(m.c, cat) && sameName(m.n, name));

/* ---------- Aksi. Tiap fungsi mengubah `s` (state stok) atau melempar HttpError ---------- */

function addItem(s, b) {
  const n = clean(b.n, 60),
    c = clean(b.c, 30),
    hasV = hasValue(b.v),
    v = hasV ? parseVariants(b.v) : null,
    p = v ? cheapest(v) : Math.round(Number(b.p));
  if (!n || !c || (hasV && !v) || !validPrice(p, 0)) throw bad();
  if (s.items.length >= MAX_ITEMS) throw new HttpError(409, "full");
  if (isDuplicate(s, c, n)) throw new HttpError(409, "dupe");
  // pakai penulisan kategori yang sudah ada (misal "espresso" -> "Espresso")
  const known = s.items.find((m) => sameName(m.c, c));
  const cat = known ? known.c : c;
  if (!known && b.food === true && !s.food.includes(cat)) s.food.push(cat);
  s.items.push({ id: s.nextId, c: cat, n, p, ...(v ? { v } : {}) });
  s.nextId++;
}

function editItem(s, b) {
  const m = s.items.find((x) => x.id === Number(b.id));
  if (!m) throw notFound();
  const n = b.n === undefined ? m.n : clean(b.n, 60);
  if (!n) throw bad();
  if (isDuplicate(s, m.c, n, m.id)) throw new HttpError(409, "dupe");
  if (hasValue(b.v)) {
    const v = parseVariants(b.v);
    if (!v) throw bad();
    // status habis per varian ikut terbawa untuk varian yang namanya sama
    const was = new Map((m.v || []).map((z) => [z.k, !!z.off]));
    m.v = v.map((z) => (was.get(z.k) ? { ...z, off: true } : z));
    m.p = cheapest(v);
    delete m.off;
  } else {
    const p = Math.round(Number(b.p));
    if (!validPrice(p, 0)) throw bad();
    delete m.v;
    m.p = p;
  }
  m.n = n;
}

function deleteItem(s, b) {
  const id = Number(b.id);
  if (!s.items.some((x) => x.id === id)) throw notFound();
  s.items = s.items.filter((x) => x.id !== id);
  // kategori yang sudah kosong ikut dibersihkan dari daftar tutup dan daftar makanan
  const left = new Set(s.items.map((x) => x.c));
  s.closed = s.closed.filter((c) => left.has(c));
  s.food = s.food.filter((c) => left.has(c));
}

// { id, off } atau { id, k, off }: tandai habis / tersedia
function toggleStock(s, b) {
  const m = s.items.find((x) => x.id === Number(b.id));
  if (!m) throw notFound();
  if (b.k !== undefined) {
    const z = (m.v || []).find((x) => x.k === b.k);
    if (!z) throw notFound();
    if (b.off === true) z.off = true;
    else delete z.off;
    return;
  }
  if (b.off === true) m.off = true;
  else delete m.off;
  // menu bervarian: tombol habis/tersedia di tingkat menu berlaku untuk semua varian
  if (m.v)
    m.v = m.v.map(({ off, ...z }) => (b.off === true ? { ...z, off: true } : z));
}

// { cats:[...], closed }: tutup atau buka kategori
function toggleCategories(s, b) {
  const known = new Set(s.items.map((m) => m.c));
  const cats = b.cats.map(String).filter((c) => known.has(c));
  if (!cats.length) throw bad();
  s.closed = s.closed.filter((c) => !cats.includes(c));
  if (b.closed === true) s.closed.push(...cats);
}

const ACTIONS = { add: addItem, edit: editItem, del: deleteItem };

function apply(s, b) {
  if (Object.hasOwn(ACTIONS, b.action)) return ACTIONS[b.action](s, b);
  if (b.id !== undefined) return toggleStock(s, b);
  if (Array.isArray(b.cats)) return toggleCategories(s, b);
  throw bad();
}

module.exports = handle(
  async (req, res) => {
    await requireAdmin(req);
    if (req.method === "GET") return res.json(stockView(await getStockState()));
    allow(req, "POST");
    requireSameOrigin(req);

    const s = await getStockState();
    apply(s, req.body || {});
    await putStockState(s);
    res.json(stockView(s));
  },
  // pesan error dikirim ke admin (sudah lolos requireAdmin), supaya penyebab muncul di tab Stok
  { exposeDetail: true },
);
