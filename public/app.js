const K = "qahwa_order",
  $ = (s) => document.querySelector(s),
  rp = (n) => "Rp " + Number(n).toLocaleString("id-ID"),
  esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
/* Menu contoh hanya untuk pratinjau tanpa server. Saat live, menu dan harga diambil dari /api/menu. */
const SAMPLE = [
  { id: 1, c: "Best Seller", n: "Sanger Aren", p: 20000 },
  { id: 2, c: "Best Seller", n: "Sanger Creamy", p: 22000 },
  { id: 3, c: "Espresso", n: "Americano", p: 18000 },
  { id: 4, c: "Espresso", n: "Coffee Latte", p: 22000 },
  { id: 5, c: "Makanan", n: "Nasi Goreng", p: 25000 },
  { id: 6, c: "Crispy", n: "Kentang Original", p: 15000 },
];
const MODE_TXT = {
  mock: "MODE SIMULASI: pembayaran palsu, tidak ada uang sungguhan",
  sandbox: "MODE UJI MIDTRANS: tidak ada uang sungguhan",
};
/* Meja otomatis: QR di meja membawa kode (?m=KODE). Server menerjemahkan kode jadi nama meja; pelanggan tidak memilih meja. */
const TAKE = "Bawa pulang",
  tl = (t) => (t == TAKE ? TAKE : "Meja " + t);
let CODE = (new URLSearchParams(location.search).get("m") || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12),
  T = "",
  CFG = {},
  MENU = [],
  demo = false,
  view = "menu",
  lv = "",
  cat = "Semua",
  cart = {},
  buyer = { name: "", note: "" },
  ord = null;
try {
  ord = JSON.parse(localStorage.getItem(K) || "null");
} catch (e) {}
const FIN = (s) => s == "done" || s == "failed",
  save = () => {
    try {
      ord
        ? localStorage.setItem(K, JSON.stringify(ord))
        : localStorage.removeItem(K);
    } catch (e) {}
  },
  total = () => MENU.reduce((s, m) => s + (cart[m.id] || 0) * m.p, 0),
  toast = (t) => {
    const e = $("#msg");
    e.textContent = t;
    e.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (e.hidden = true), 4000);
  },
  post = (u, b) =>
    fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    });

const card = (m) =>
  `<div class="mi"><span class="nm">${esc(m.n)}</span>${m.p > 0 ? `<span class="pc">${rp(m.p)}</span>${cart[m.id] ? `<div class="qty"><button data-a="m:${m.id}" aria-label="Kurangi">−</button><i>${cart[m.id]}</i><button data-a="p:${m.id}" aria-label="Tambah">+</button></div>` : `<button class="add" data-a="p:${m.id}">Tambah</button>`}` : `<span class="soon">Segera</span>`}</div>`;
function hiV() {
  if (T)
    return `<div class="card hi"><b>${T == TAKE ? "Selamat datang!" : "Selamat datang, pelanggan " + esc(tl(T))}</b><p class="muted">${T == TAKE ? "Pesananmu untuk dibawa pulang." : "Pesananmu akan diantar ke meja ini. Tidak perlu memilih meja."}</p></div>`;
  if (demo) return "";
  return `<div class="card hi"><b>${CODE ? "QR meja ini tidak dikenali" : "Scan QR di mejamu untuk memesan"}</b><p class="muted">${CODE ? "Minta staf untuk QR terbaru, atau scan QR di meja lain." : "Kamu bisa melihat menu dulu. Pesanan hanya bisa dibuat lewat QR meja."}</p></div>`;
}
function menuV() {
  const cats = ["Semua", ...new Set(MENU.map((m) => m.c))];
  return (
    hiV() +
    (ord && !FIN(ord.status)
      ? `<button class="btn ghost" data-a="v:track">Pesanan aktif ${esc(ord.id)}: lihat status</button>`
      : "") +
    `<div class="chips">${cats.map((c) => `<button data-a="c:${esc(c)}" class="${c == cat ? "on" : ""}">${esc(c)}</button>`).join("")}</div>${cats
      .slice(1)
      .filter((c) => cat == "Semua" || c == cat)
      .map(
        (c) =>
          `<h2 class="cat">${esc(c)}</h2><div class="list">${MENU.filter(
            (m) => m.c == c,
          )
            .map(card)
            .join("")}</div>`,
      )
      .join("")}`
  );
}
function coV() {
  return (
    `<h2>Pesananmu</h2>` +
    MENU.filter((m) => cart[m.id])
      .map(
        (m) =>
          `<div class="row"><span>${cart[m.id]}x ${esc(m.n)}</span><b>${rp(cart[m.id] * m.p)}</b></div>`,
      )
      .join("") +
    `<div class="row"><b>Total</b><b>${rp(total())}</b></div>
  <label>Nama<input id="nm" maxlength="30" value="${esc(buyer.name)}" placeholder="Nama pemesan"></label>
  <div class="row"><span>Meja</span><b>${T ? esc(tl(T)) : "Belum ada"}</b></div>${T ? "" : `<div class="alert" role="alert">Scan QR di mejamu dulu untuk memesan.</div>`}
  <label>Catatan<input id="nt" maxlength="60" value="${esc(buyer.note)}" placeholder="Contoh: less sugar"></label>
  <button class="btn" id="pay" data-a="pay"${T ? "" : " disabled"}>Bayar sekarang</button><button class="btn ghost" data-a="v:menu">Kembali ke menu</button>`
  );
}
function trackV() {
  const o = ord,
    i = ["pending", "paid", "making", "ready", "done"].indexOf(o.status),
    msg = {
      pending: "Menunggu pembayaran",
      paid: "Pembayaran diterima, pesananmu masuk antrian",
      making: "Pesananmu sedang dibuat",
      ready: "Pesananmu siap",
      done: "Selesai, terima kasih",
      failed: "Pembayaran gagal atau kedaluwarsa",
    }[o.status];
  return (
    `<h2>${esc(o.id)}</h2><p class="muted">${o.table == "Bawa pulang" ? "Bawa pulang" : "Meja " + esc(o.table)}</p><div class="card center"><b>${msg}</b></div>` +
    (o.status == "failed"
      ? ""
      : `<ol class="steps">${["Dibayar", "Dibuat", "Siap", "Selesai"].map((t, k) => `<li class="${i > k ? "on" : ""}">${t}</li>`).join("")}</ol>`) +
    (o.items || [])
      .map(
        (l) =>
          `<div class="row"><span>${l.q}× ${esc(l.n)}</span><b>${rp(l.q * l.p)}</b></div>`,
      )
      .join("") +
    (o.status == "pending" && CFG.mode == "mock"
      ? `<div class="card"><b>Simulasi pembayaran QRIS</b><p class="muted">Ini pengganti halaman Midtrans untuk uji coba. Tidak ada uang yang bergerak.</p><button class="btn" data-a="sim:paid">Simulasikan bayar berhasil</button><button class="btn ghost" data-a="sim:failed">Simulasikan gagal</button></div>`
      : "") +
    (o.status == "pending" && CFG.mode != "mock"
      ? `<button class="btn" data-a="snap">Lanjut bayar</button>`
      : "") +
    (FIN(o.status)
      ? `<button class="btn" data-a="new">Pesan lagi</button>`
      : `<button class="btn ghost" data-a="v:menu">Tambah pesanan baru</button>`)
  );
}
function paint() {
  const scrollY = window.scrollY; // Simpan posisi scroll vertikal layar

  // Ambil posisi scroll horizontal chips saat ini sebelum DOM di-render ulang
  const oldChips = document.querySelector(".chips");
  const chipScrollLeft = oldChips ? oldChips.scrollLeft : 0;

  $("#app").innerHTML =
    view == "co" ? coV() : view == "track" && ord ? trackV() : menuV();

  const n = Object.values(cart).reduce((a, b) => a + b, 0);
  $("#cart").hidden = !(view == "menu" && n);
  $("#cart").innerHTML =
    `<div><b>${n} item</b><br>${rp(total())}</div><button data-a="co">Lanjut</button>`;
  $("#mj").hidden = !T;
  $("#mj").textContent = T ? tl(T) : "";

  // Pulihkan posisi scroll horizontal chips dan pastikan tombol aktif tersorot
  const newChips = document.querySelector(".chips");
  if (newChips) {
    newChips.scrollLeft = chipScrollLeft;
    const activeChip = newChips.querySelector(".on");
    if (activeChip) {
      activeChip.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
        block: "nearest",
      });
    }
  }

  if (view != lv) {
    scrollTo(0, 0);
    lv = view;
    const a = $("#app");
    a.classList.remove("in");
    void a.offsetWidth;
    a.classList.add("in");
  } else {
    window.scrollTo(0, scrollY); // Pertahankan posisi scroll vertikal saat ganti kategori
  }
}

/* Pembayaran: server membuat transaksi, browser hanya membuka Snap (sandbox/production) atau simulasi (mock) */
function loadSnap() {
  return new Promise((ok, no) => {
    if (window.snap) return ok();
    const s = document.createElement("script");
    s.src = CFG.snapUrl;
    s.dataset.clientKey = CFG.clientKey;
    s.onload = ok;
    s.onerror = no;
    document.head.appendChild(s);
  });
}
async function snapPay() {
  if (CFG.mode == "mock") return;
  try {
    await loadSnap();
    snap.pay(ord.token, {
      onSuccess: poll,
      onPending: poll,
      onClose: poll,
      onError: poll,
    });
  } catch (e) {
    toast("Midtrans tidak dapat dimuat.");
  }
}
async function pay() {
  if (!T) return toast("Scan QR di mejamu dulu untuk memesan.");
  if (demo)
    return toast(
      "Pratinjau: pembayaran aktif setelah proyek dijalankan dengan server.",
    );
  const b = $("#pay"),
    t = total();
  b.disabled = true;
  b.textContent = "Memproses...";
  try {
    const r = await post("/api/order", {
      items: Object.entries(cart).map(([id, q]) => ({ id: +id, q })),
      name: buyer.name,
      note: buyer.note,
      code: CODE,
    });
    const j = await r.json();
    if (!j.token) throw r.status;
    ord = {
      id: j.id,
      token: j.token,
      status: "pending",
      table: T,
      name: buyer.name,
      items: [],
      total: t,
    };
    cart = {};
    save();
    view = "track";
    paint();
    poll();
    snapPay();
  } catch (e) {
    toast(
      e == 429
        ? "Terlalu banyak percobaan. Tunggu sebentar."
        : e == 400
          ? "QR meja tidak dikenali. Scan ulang QR di mejamu."
          : "Gagal membuat pembayaran. Coba lagi.",
    );
    b.disabled = false;
    b.textContent = "Bayar sekarang";
  }
}
async function sim(result) {
  try {
    const r = await post("/api/mockpay", { id: ord.id, result });
    if (!r.ok) throw 0;
  } catch (e) {
    toast("Simulasi gagal.");
  }
  poll();
}
async function poll() {
  if (!ord || demo) return;
  try {
    const r = await fetch("/api/order?id=" + encodeURIComponent(ord.id));
    if (r.ok) {
      ord = { ...ord, ...(await r.json()) };
      save();
    } else if (r.status == 404) {
      ord = null;
      save();
      view = "menu";
    }
  } catch (e) {}
  if (view == "track") paint();
}
async function init() {
  const tf = CODE
    ? fetch("/api/table?c=" + encodeURIComponent(CODE)).catch(() => null)
    : Promise.resolve(null);
  try {
    const [r, t] = await Promise.all([fetch("/api/menu"), tf]);
    if (!r.ok) throw 0;
    CFG = await r.json();
    MENU = CFG.menu;
    if (t && t.ok) T = (await t.json()).t;
  } catch (e) {
    demo = true;
    CFG = { mode: "mock" };
    MENU = SAMPLE;
    T = "5";
    ord = null;
  }
  cat = (MENU[0] || {}).c || "Semua";
  greet();
  const bn = $("#mode");
  if (MODE_TXT[CFG.mode] && !demo) {
    bn.textContent = MODE_TXT[CFG.mode];
    bn.hidden = false;
  }
  if (!demo && ord && !FIN(ord.status)) {
    view = "track";
    poll();
  }
  paint();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]");
  if (!b) return;
  const [a, ...r] = b.dataset.a.split(":"),
    v = r.join(":");
  if (a == "c") cat = v;
  else if (a == "p") cart[v] = (cart[v] || 0) + 1;
  else if (a == "m") {
    cart[v] > 1 ? cart[v]-- : delete cart[v];
  } else if (a == "co") view = "co";
  else if (a == "v") view = v;
  else if (a == "go") return enter();
  else if (a == "pay") return pay();
  else if (a == "snap") return snapPay();
  else if (a == "sim") return sim(v);
  else if (a == "new") {
    ord = null;
    save();
    view = "menu";
  }
  paint();
});
document.addEventListener("input", (e) => {
  const i = e.target.id;
  if (i == "nm") buyer.name = e.target.value;
  if (i == "nt") buyer.note = e.target.value;
});
setInterval(() => {
  if (view == "track" && ord && !FIN(ord.status)) poll();
}, 4000);
/* Layar pembuka 3D: tampil dulu sebelum menu. Adegan three.js dimuat belakangan; jika gagal, tampil versi CSS. */
let stopHero = null;
function intro() {
  const el = $("#intro");
  if (!el) return;
  $("#go").textContent =
    ord && !FIN(ord.status) ? "Lihat pesanan" : "Mulai pesan";
  import("/intro.js")
    .then((m) => {
      if (!el.isConnected) return;
      try {
        stopHero = m.startHero($("#cv"));
        el.classList.add("gl");
      } catch (e) {}
    })
    .catch(() => {});
}
function greet() {
  // sambutan di layar pembuka, diisi setelah server menjawab nama meja
  const g = $("#greet");
  if (!g) return;
  g.hidden = false;
  g.innerHTML =
    T == TAKE
      ? `Selamat datang! <b>Pesanan bawa pulang</b>`
      : T
        ? `Selamat datang, <b>pelanggan ${esc(tl(T))}</b>`
        : CODE
          ? `QR meja ini tidak dikenali. <b>Minta staf QR terbaru</b>`
          : `Scan QR di mejamu untuk memesan`;
}
function enter() {
  const el = $("#intro");
  if (!el) return;
  el.classList.add("leave");
  if (stopHero) stopHero();
  stopHero = null;
  setTimeout(() => el.remove(), 800);
}
/* Kartu menu miring mengikuti kursor (mouse saja) */
document.addEventListener("pointermove", (e) => {
  if (e.pointerType != "mouse") return;
  const m = e.target.closest && e.target.closest(".m");
  if (!m) return;
  const r = m.getBoundingClientRect(),
    x = (e.clientX - r.left) / r.width - 0.5,
    y = (e.clientY - r.top) / r.height - 0.5;
  m.style.setProperty("--ry", x * 14 + "deg");
  m.style.setProperty("--rx", -y * 14 + "deg");
});
document.addEventListener("pointerout", (e) => {
  const m = e.target.closest && e.target.closest(".m");
  if (m && !m.contains(e.relatedTarget)) {
    m.style.removeProperty("--rx");
    m.style.removeProperty("--ry");
  }
});
intro();
init();
