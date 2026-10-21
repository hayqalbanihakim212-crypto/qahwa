(function () {
  /* Halaman pesan Qahwa, terhubung ke Supabase (aplikasi kasir). Helper bersama ($, rp, esc, stepsHtml) tetap dari common.js */

  /* ===== PENGATURAN ===== */
  const SB_URL = "https://yzuzqyfptelkuahrxeta.supabase.co";
  const SB_KEY = "sb_publishable_gWLPn38x-EVvixRq-FMVpQ_yz2N4z0j"; // kunci publik, aman di website
  const SLUG = "qahwa"; // slug toko di aplikasi kasir
  /* ====================== */

  const K = "qahwa_order_v2"; // kunci baru: pesanan lama dari backend lama tidak terbawa
  /* Meja otomatis: QR membawa kode (?meja=KODE). ?m= tetap dibaca, tetapi kode lama tidak dikenali Supabase. */
  const qs = new URLSearchParams(location.search);
  let CODE = (qs.get("meja") || qs.get("m") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12),
    T = "",
    SHOP = {},
    CLOSED = [],
    MENU = [],
    fail = false,
    view = "menu",
    lv = "",
    cat = "Semua",
    cart = {},
    buyer = { name: "", note: "" },
    ord = null;
  try {
    ord = JSON.parse(localStorage.getItem(K) || "null");
  } catch (e) {}

  const tl = (t) => (/^\d+$/.test(t) ? "Meja " + t : t);
  const isTake = (t) => /^bawa pulang$/i.test(t || "");

  function rpc(name, body) {
    return fetch(SB_URL + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB_KEY },
      body: JSON.stringify(body || {}),
    }).then((r) =>
      r.json().then((j) => {
        if (!r.ok) throw new Error((j && j.message) || "error");
        return j;
      }),
    );
  }

  /* Keranjang: kunci "id" (menu biasa) atau "id:Varian". Harga dibaca dari menu, bukan disimpan di keranjang. */
  const splitKey = (key) => {
    const i = key.indexOf(":");
    return i < 0 ? [key, null] : [key.slice(0, i), key.slice(i + 1)];
  };
  function lines() {
    return Object.entries(cart)
      .map(([key, q]) => {
        const [id, k] = splitKey(key),
          m = MENU.find((x) => x.id == id),
          vr = k && m ? (m.v || []).find((z) => z.k == k) : null;
        if (!m || na(m) || (k && (!vr || vr.off))) return null;
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
    };

  const isClosed = (c) => CLOSED.includes(c);
  const na = (m) => m.off || isClosed(m.c);
  const online = () => SHOP.online !== false;
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
    if (fail)
      return `<div class="card hi"><b>Menu tidak bisa dimuat</b><p class="muted">Coba muat ulang halaman.</p></div>`;
    if (!online())
      return `<div class="card hi"><b>Pesan online sedang ditutup</b><p class="muted">Kamu masih bisa melihat menu. Silakan pesan langsung ke kasir.</p></div>`;
    if (T)
      return `<div class="card hi"><b>${isTake(T) ? "Selamat datang!" : "Selamat datang, pelanggan " + esc(tl(T))}</b><p class="muted">${isTake(T) ? "Pesananmu untuk dibawa pulang." : "Pesananmu akan diantar ke meja ini. Tidak perlu memilih meja."}</p></div>`;
    return `<div class="card hi"><b>${CODE ? "QR meja ini tidak dikenali" : "Scan QR di mejamu untuk memesan"}</b><p class="muted">${CODE ? "Minta staf untuk QR terbaru, atau scan QR di meja lain." : "Kamu bisa melihat menu dulu. Pesanan hanya bisa dibuat lewat QR meja."}</p></div>`;
  }
  function menuV() {
    const cats = ["Semua", ...new Set(MENU.map((m) => m.c))];
    return (
      hiV() +
      (ord && !FIN(ord.status)
        ? `<button class="btn ghost" data-a="v:track">Pesanan aktif ${esc(ord.no)}: lihat status</button>`
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
  const canPay = () => T && online();
  const payOnline = () => SHOP.web_pay == "midtrans";
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
  <div class="row"><span>Meja</span><b>${T ? esc(tl(T)) : "Belum ada"}</b></div>${T ? "" : `<div class="alert" role="alert">Scan QR di mejamu dulu untuk memesan.</div>`}${online() ? "" : `<div class="alert" role="alert">Pesan online sedang ditutup.</div>`}
  <label>Catatan<input id="nt" maxlength="60" value="${esc(buyer.note)}" placeholder="Contoh: less sugar"></label>
  <p class="muted">${payOnline() ? "Pembayaran online (QRIS/e-wallet) setelah menekan tombol." : "Bayar di kasir setelah memesan."}</p>
  <button class="btn" id="pay" data-a="pay"${canPay() ? "" : " disabled"}>${payOnline() ? "Bayar sekarang" : "Pesan sekarang"}</button><button class="btn ghost" data-a="v:menu">Kembali ke menu</button>`
    );
  }
  function trackV() {
    const o = ord,
      i = ["pending", "paid", "making", "ready", "done"].indexOf(o.status),
      msg = {
        pending:
          o.pay == "online"
            ? "Menunggu pembayaran"
            : "Menunggu pembayaran di kasir",
        paid: "Pesananmu masuk antrian",
        making: "Pesananmu sedang dibuat",
        ready: "Pesananmu siap",
        done: "Selesai, terima kasih",
        failed: "Pembayaran gagal atau pesanan dibatalkan",
      }[o.status];
    return (
      `<h2>${esc(o.no)}</h2><p class="muted">${esc(tl(o.table || ""))}</p><div class="card center"><b>${msg}</b></div>` +
      (o.status == "failed" ? "" : stepsHtml(i)) +
      (o.items || [])
        .map(
          (l) =>
            `<div class="row"><span>${l.q}× ${esc(l.n)}</span><b>${rp(l.q * l.p)}</b></div>`,
        )
        .join("") +
      (o.status == "pending" && o.pay == "online"
        ? `<button class="btn" data-a="snap">Lanjut bayar</button>`
        : "") +
      (FIN(o.status)
        ? `<button class="btn" data-a="new">Pesan lagi</button>`
        : `<button class="btn ghost" data-a="v:menu">Tambah pesanan baru</button>`)
    );
  }
  function paint() {
    const scrollY = window.scrollY;
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

    const newChips = document.querySelector(".chips");
    if (newChips) {
      newChips.scrollLeft = chipScrollLeft;
      const activeChip = newChips.querySelector(".on");
      if (activeChip)
        activeChip.scrollIntoView({
          behavior: "smooth",
          inline: "nearest",
          block: "nearest",
        });
    }

    if (view != lv) {
      scrollTo(0, 0);
      lv = view;
      const a = $("#app");
      a.classList.remove("in");
      void a.offsetWidth;
      a.classList.add("in");
    } else {
      window.scrollTo(0, scrollY);
    }
  }

  /* ---- Midtrans (aktif nanti): berjalan hanya bila toko memilih "Pembayaran online" di aplikasi ---- */
  function loadSnap(url, key) {
    return new Promise((ok, no) => {
      if (window.snap) return ok();
      const s = document.createElement("script");
      s.src = url;
      s.dataset.clientKey = key;
      s.onload = ok;
      s.onerror = no;
      document.head.appendChild(s);
    });
  }
  function snapPay() {
    if (!ord || ord.pay != "online") return;
    fetch(SB_URL + "/functions/v1/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
      },
      body: JSON.stringify({ order_id: ord.id, secret: ord.secret }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.token) throw new Error(j.error || "pay");
        return loadSnap(j.snap_url, j.client_key).then(() =>
          window.snap.pay(j.token, {
            onSuccess: poll,
            onPending: poll,
            onClose: poll,
            onError: poll,
          }),
        );
      })
      .catch(() =>
        toast("Pembayaran online belum tersedia. Silakan bayar di kasir."),
      );
  }

  async function pay() {
    if (!T) return toast("Scan QR di mejamu dulu untuk memesan.");
    const b = $("#pay"),
      t = total(),
      ls = lines();
    if (!ls.length) return toast("Keranjang kosong. Pilih menu dulu.");
    b.disabled = true;
    b.textContent = "Memproses...";
    try {
      const j = await rpc("public_place_order", {
        p_slug: SLUG,
        p_code: CODE,
        p_items: ls.map((l) => ({ id: l.m.id, v: l.k, q: l.q })),
        p_name: buyer.name,
        p_note: buyer.note,
      });
      ord = {
        id: j.id,
        secret: j.secret,
        no: j.no,
        status: "pending",
        table: T,
        items: [],
        total: t,
        pay: j.web_pay == "midtrans" ? "online" : "counter",
      };
      cart = {};
      save();
      view = "track";
      paint();
      poll();
      if (ord.pay == "online") snapPay();
    } catch (e) {
      const m = String(e.message || "");
      if (/unavailable/.test(m)) {
        toast("Ada menu yang habis atau ditutup. Menu sudah diperbarui.");
        return refresh(true).then(() => {
          view = "menu";
          paint();
        });
      }
      toast(
        /table/.test(m)
          ? "QR meja tidak dikenali. Scan ulang QR di mejamu."
          : /too_many/.test(m)
            ? "Terlalu banyak pesanan. Tunggu sebentar."
            : /closed/.test(m)
              ? "Toko sedang tidak menerima pesanan online."
              : /empty/.test(m)
                ? "Keranjang kosong. Pilih menu dulu."
                : "Gagal membuat pesanan. Coba lagi.",
      );
      b.disabled = false;
      b.textContent = payOnline() ? "Bayar sekarang" : "Pesan sekarang";
    }
  }
  async function poll() {
    if (!ord) return;
    try {
      const j = await rpc("public_order", {
        p_id: ord.id,
        p_secret: ord.secret,
      });
      if (!j) {
        ord = null;
        save();
        view = "menu";
        return paint();
      }
      ord = { ...ord, ...j };
      save();
    } catch (e) {}
    if (view == "track") paint();
  }

  let sig = "";
  function applyMenu(j) {
    SHOP = j.shop || {};
    CLOSED = (j.categories || []).filter((c) => c.closed).map((c) => c.name);
    MENU = j.menu || [];
    Object.keys(cart).forEach((key) => {
      const [id, k] = splitKey(key),
        m = MENU.find((x) => x.id == id);
      if (!m || na(m) || (k && !(m.v || []).some((z) => z.k == k && !z.off)))
        delete cart[key];
    });
  }
  /* Menu dimuat ulang tiap 30 detik agar stok habis dan kategori tutup langsung berlaku */
  async function refresh(force) {
    if (fail) return;
    try {
      const j = await rpc("public_menu", { p_slug: SLUG }),
        s = JSON.stringify(j);
      if (s == sig && !force) return;
      sig = s;
      applyMenu(j);
      if (view != "track") paint();
    } catch (e) {}
  }
  setInterval(refresh, 30000);
  async function init() {
    try {
      const [j, t] = await Promise.all([
        rpc("public_menu", { p_slug: SLUG }),
        CODE
          ? rpc("public_table", { p_slug: SLUG, p_code: CODE }).catch(
              () => null,
            )
          : null,
      ]);
      sig = JSON.stringify(j);
      applyMenu(j);
      T = t || "";
    } catch (e) {
      fail = true;
    }
    cat = (MENU[0] || {}).c || "Semua";
    greet();
    if (!fail && ord && !FIN(ord.status)) {
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
    else if (a == "p") cart[v] = Math.min(20, (cart[v] || 0) + 1);
    else if (a == "m") {
      cart[v] > 1 ? cart[v]-- : delete cart[v];
    } else if (a == "co") view = "co";
    else if (a == "v") view = v;
    else if (a == "go") return enter();
    else if (a == "pay") return pay();
    else if (a == "snap") return snapPay();
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
    const g = $("#greet");
    if (!g) return;
    g.hidden = false;
    g.innerHTML = fail
      ? `Menu tidak bisa dimuat. <b>Coba muat ulang</b>`
      : T
        ? isTake(T)
          ? `Selamat datang! <b>Pesanan bawa pulang</b>`
          : `Selamat datang, <b>pelanggan ${esc(tl(T))}</b>`
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
})();
