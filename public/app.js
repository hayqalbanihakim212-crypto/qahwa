/* Helper bersama ($, rp, esc, TAKE, tl, stepsHtml) ada di common.js */
const K = "qahwa_order";
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
/* Keranjang: kunci "id" (menu biasa) atau "id:Varian" (menu panas/dingin/float). Harga dibaca dari menu, bukan disimpan di keranjang. */
function lines() {
  return Object.entries(cart)
    .map(([key, q]) => {
      const [id, k] = key.split(":"),
        m = MENU.find((x) => x.id == id),
        vr = k && m ? (m.v || []).find((z) => z.k == k) : null;
      if (!m || (k && (!vr || vr.off))) return null;
      return { m, k, q, p: vr ? vr.p : m.p, key };
    })
    .filter(Boolean);
}
const FIN = (s) => s == "done" || s == "failed",
  save = () => {
    try {
      ord
        ? localStorage.setItem(K, JSON.stringify(ord))
        : localStorage.removeItem(K);
    } catch (e) {}
  },
  total = () => lines().reduce((s, l) => s + l.q * l.p, 0),
  toast = (t) => {
    const e = $("#msg");
    e.textContent = t;
    e.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (e.hidden = true), 4000);
  },
  post = (u, b, h = {}) =>
    fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...h },
      body: JSON.stringify(b),
    });

const isClosed = (c) => (CFG.closed || []).includes(c);
const na = (m) => m.off || isClosed(m.c);
const ctl = (key) =>
  cart[key]
    ? `<div class="qty"><button data-a="m:${key}" aria-label="Kurangi">−</button><i>${cart[key]}</i><button data-a="p:${key}" aria-label="Tambah">+</button></div>`
    : `<button class="add" data-a="p:${key}">Tambah</button>`;
const card = (m) => {
  const dead = na(m);
  if (m.v && m.p > 0 && !dead)
    return `<div class="mi var"><span class="nm">${esc(m.n)}</span><div class="vs">${m.v
      .map(
        (z) =>
          `<div class="vr${z.off ? " off" : ""}"><span class="vk">${esc(z.k)}</span>${z.off ? '<span class="soon">Habis</span>' : `<span class="pc">${rp(z.p)}</span>${ctl(m.id + ":" + z.k)}`}</div>`,
      )
      .join("")}</div></div>`;
  return `<div class="mi${dead ? " off" : ""}"><span class="nm">${esc(m.n)}</span>${
    m.p > 0 && !dead
      ? `<span class="pc">${rp(m.p)}</span>${ctl(String(m.id))}`
      : `<span class="soon">${m.p > 0 ? (isClosed(m.c) ? "Ditutup" : "Habis") : "Segera"}</span>`
  }</div>`;
};
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
          `<h2 class="cat">${esc(c)}</h2>${isClosed(c) ? '<p class="muted center">Sedang ditutup</p>' : ""}<div class="list">${MENU.filter(
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
    lines()
      .map(
        (l) =>
          `<div class="row"><span>${l.q}x ${esc(l.m.n)}${l.k ? " (" + esc(l.k) + ")" : ""}</span><b>${rp(l.q * l.p)}</b></div>`,
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
    `<h2>${esc(o.id)}</h2><p class="muted">${esc(tl(o.table))}</p><div class="card center"><b>${msg}</b></div>` +
    (o.status == "failed"
      ? ""
      : stepsHtml(i)) +
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
// kode error dari POST /api/order -> pesan untuk pelanggan
const PAY_ERROR = {
  too_many: "Terlalu banyak percobaan. Tunggu sebentar.",
  table: "QR meja tidak dikenali. Scan ulang QR di mejamu.",
  empty: "Keranjang kosong. Pilih menu dulu.",
};
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
      items: lines().map((l) => ({ id: l.m.id, v: l.k, q: l.q })),
      name: buyer.name,
      note: buyer.note,
      code: CODE,
    });
    const j = await r.json();
    if (!j.token) throw j.error || r.status;
    ord = {
      id: j.id,
      token: j.token,
      status: "pending",
      table: T,
      name: buyer.name,
      items: [],
      sec: j.sec,
      total: t,
    };
    cart = {};
    save();
    view = "track";
    paint();
    poll();
    snapPay();
  } catch (e) {
    if (e == "unavailable") {
      toast("Ada menu yang habis atau ditutup. Menu sudah diperbarui.");
      return refresh().then(() => {
        view = "menu";
        paint();
      });
    }
    toast(PAY_ERROR[e] || "Gagal membuat pembayaran. Coba lagi.");
    b.disabled = false;
    b.textContent = "Bayar sekarang";
  }
}
async function sim(result) {
  try {
    await post(
      "/api/mockpay",
      { id: ord.id, result },
      { "x-order-token": ord.sec },
    );
  } catch (e) {
    toast("Simulasi gagal.");
  }
  poll();
}
async function poll() {
  if (!ord || demo) return;
  try {
    const r = await fetch("/api/order?id=" + encodeURIComponent(ord.id), {
      headers: { "x-order-token": ord.sec || "" },
    });
    if (r.ok) {
      ord = { ...ord, ...(await r.json()) };
      save();
    } else if (r.status == 404) {
      ord = null;
      save();
      view = "menu";
      return paint();
    }
  } catch (e) {}
  if (view == "track") paint();
}
let sig = "";
/* Menu dimuat ulang tiap 30 detik agar stok habis dan kategori tutup langsung berlaku */
async function refresh() {
  if (demo) return;
  try {
    const r = await fetch("/api/menu");
    if (!r.ok) return;
    const j = await r.json(),
      s = JSON.stringify([j.menu, j.closed]);
    if (s == sig) return;
    sig = s;
    CFG = { ...CFG, ...j };
    MENU = j.menu;
    Object.keys(cart).forEach((key) => {
      const [id, k] = key.split(":"),
        m = MENU.find((x) => x.id == id);
      if (!m || na(m) || (k && !(m.v || []).some((z) => z.k == k && !z.off)))
        delete cart[key];
    });
    if (view != "track") paint();
  } catch (e) {}
}
setInterval(refresh, 30000);
async function init() {
  const tf = CODE
    ? fetch("/api/table?c=" + encodeURIComponent(CODE)).catch(() => null)
    : Promise.resolve(null);
  try {
    const [r, t] = await Promise.all([fetch("/api/menu"), tf]);
    if (!r.ok) throw 0;
    CFG = await r.json();
    MENU = CFG.menu;
    sig = JSON.stringify([MENU, CFG.closed]);
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
intro();
init();
